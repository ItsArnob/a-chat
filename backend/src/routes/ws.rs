use std::time::{Duration, UNIX_EPOCH};

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::{
    sync::mpsc::{self, UnboundedSender},
    time::timeout,
};
use tracing::{debug, warn};

use crate::{
    app::AppState,
    database::models::{
        chat, message, session,
        user::{self, RelatedUserStatus, Relation, RelationStatus},
    },
    util::result::{ApiError, ApiResult},
};

use super::{chat::{MessageJson, MessageSaveResponse}, users::ChatJson};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadyData {
    id: String,
    username: String,
    users: Vec<RelatedUserStatus>,
    chats: Vec<chat::Chat>,
    last_messages: Vec<crate::routes::chat::MessageJson>,
    session_id: String,
}

pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    // close connection if client doesn't authenticate within 5 secs.
    let data = timeout(Duration::from_secs(5), socket.recv()).await;

    let rsponse = match data {
        Ok(Some(Ok(Message::Text(text)))) => {
            if let Ok(data) = serde_json::from_str::<AuthReq>(&text) {
                if data.event == "Authenticate" {
                    match prepare_ready_data(&state, &data.token).await {
                        Ok(data) => Ok(data),
                        Err(err) => {
                            if let ApiError::Unauthorized = err {
                                Err("Invalid token.")
                            } else {
                                Err("Internal Server Error")
                            }
                        }
                    }
                } else {
                    Err("Invalid authentication type.")
                }
            } else {
                Err("Invalid JSON data.")
            }
        }
        Err(_) => Err("Authentication timed out: No data received."),
        Ok(None) | Ok(Some(_)) => {
            return;
        }
    };

    match rsponse {
        Ok(data) => {
            if let Err(err) = socket
                .send(Message::Text(
                    json!({"event": "Ready", "data": data }).to_string(),
                ))
                .await
            {
                warn!("Failed to send ready message to client: {}", err)
            } else {
                let tx = setup_user_socket(&state, socket, &data).await;
                handle_disconnect(&state, &data.id, tx).await;
            }
        }
        Err(err) => {
            if let Err(err) = socket
                .send(Message::Text(
                    json!({"event": "Error", "data": {"msg": err }}).to_string(),
                ))
                .await
            {
                warn!("Failed to send error message to client: {}", err)
            }
        }
    }
}

async fn prepare_ready_data(state: &AppState, token: &str) -> ApiResult<ReadyData> {
    let (session_id, user) = session::get_user_from_token(&state.db, token).await?; // TODO: check for UnauthorizedError
    let chats = chat::get_chats_of_user(&state.db, &user.account.id).await?;

    let mut last_message_ids: Vec<&str> = vec![];
    let mut related_user_ids = if let Some(ref profile) = user.profile {
        profile.relations.iter().map(|r| r.id.as_str()).collect()
    } else {
        vec![]
    };

    for chat in &chats {
        if let Some(ref m_id) = chat.last_message_id {
            last_message_ids.push(m_id);
        }
        for recipient in &chat.recipients {
            if recipient.id != user.account.id && !related_user_ids.contains(&recipient.id.as_str())
            {
                related_user_ids.push(&recipient.id);
            }
        }
    }

    let related_users = if !related_user_ids.is_empty() {
        let empty_vec: Vec<Relation> = vec![];
        let relations = if let Some(ref profile) = user.profile {
            &profile.relations
        } else {
            &empty_vec
        };
        user::find_related_users_with_status(
            &state.db,
            &related_user_ids,
            relations,
            &state.sockets,
        )
        .await?
    } else {
        vec![]
    };

    let last_messages = if !last_message_ids.is_empty() {
        message::get_messages_by_id(&state.db, &last_message_ids).await?
    } else {
        vec![]
    };

    Ok(ReadyData {
        id: user.account.id,
        username: user.account.username,
        users: related_users,
        chats,
        last_messages,
        session_id,
    })
}

/// returns when socket disconnects.
async fn setup_user_socket(
    state: &AppState,
    socket: WebSocket,
    data: &ReadyData,
) -> UnboundedSender<String> {
    debug!("Client authenticated: {}", &data.id);

    let (tx, mut rx) = mpsc::unbounded_channel();
    let mut was_offline = false;
    let friend_ids: Vec<String> = data
        .users
        .iter()
        .filter_map(|user| {
            if let Some(RelationStatus::Friend) = user.relationship {
                Some(user.id.to_owned())
            } else {
                None
            }
        })
        .collect();
    let chat_ids = data
        .chats
        .iter()
        .filter(|chat| {
            chat.recipients
                .iter()
                .any(|recipient| friend_ids.contains(&recipient.id))
        })
        .map(|chat| chat.id.to_owned())
        .collect::<Vec<String>>();

    // database is the single source of truth. updating local state in case database was manually updated.
    for id in &chat_ids {
        let mut user_chats = state.chats.entry(id.to_owned()).or_default();
        if !user_chats.contains(&data.id) {
            user_chats.push(data.id.to_owned());
        }
    }

    let old_chat_ids = {
        let mut user_socket = state.sockets.entry(data.id.to_owned()).or_default();
        let old_chat_ids = user_socket.chats.clone();

        if !user_socket.online {
            was_offline = true;
        };
        // Replacing it in case database was manually updated.
        user_socket.chats = chat_ids.clone();
        user_socket.online = true;
        user_socket.last_seen_s = None;
        user_socket.channel.push(tx.clone());

        old_chat_ids
    };

    // removing old chats if user is not in them anymore.
    for old_chat_id in old_chat_ids {
        if !chat_ids.contains(&old_chat_id) {
            if let Some(mut users) = state.chats.get_mut(&old_chat_id) {
                users.retain(|uid| uid != &data.id);
            }
        }
    }

    let (mut sink, mut stream) = socket.split();

    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            // TODO: do something with the `ok()`. actually handle the error.
            sink.send(Message::Text(msg)).await.ok();
        }
    });

    if was_offline {
        state.emit_user_online(&data.id, &friend_ids, true, None);
    }

    // this is just an example of how to send data to the client.
    while let Some(msg) = stream.next().await {
        if let Ok(Message::Text(text)) = msg {
            match serde_json::from_str::<WsInput>(&text) {
                Ok(input) => match input.event.as_str() {
                    "ChatStartTyping" => {
                        if state.user_perm_chat_exists(&data.id, &input.data) {
                            state.emit_chat_data_except(
                                &input.data,
                                json!({
                                    "event": "ChatStartTyping",
                                    "data": {
                                        "chatId": input.data,
                                        "userId": data.id
                                    }
                                }),
                                &data.id
                            );
                        }
                    }
                    "ChatEndTyping" => {
                        if state.user_perm_chat_exists(&data.id, &input.data) {
                            state.emit_chat_data_except(
                                &input.data,
                                json!({
                                    "event": "ChatEndTyping",
                                    "data": {
                                        "chatId": input.data,
                                        "userId": data.id
                                    }
                                }),
                                &data.id
                            );
                        }
                    }
                    _ => {
                        let user_socket = state.sockets.get(&data.id).unwrap();
                        user_socket
                            .send_json(&json!({ "event":"Error", "data": "Unknown event." }));
                    }
                },
                Err(_) => {
                    // unwrapping it because this is impossible. data was inserted before this code. (unless the hashmap was modified somewhere else???)
                    let user_socket = state.sockets.get(&data.id).unwrap();
                    user_socket
                        .send_json(&json!({ "event": "Error", "data": "Invalid json data." }));
                }
            }
        }
    }

    tx
}

async fn handle_disconnect(state: &AppState, user_id: &str, tx: UnboundedSender<String>) {
    // making a copy because we dont want to keep the sockets dashmap locked for long.

    let (has_no_clients, user_chats, last_seen_s) = {
        // unwrapping it because this is impossible. data was inserted before this code. (unless the hashmap was modified somewhere else???)

        let mut user_socket = state.sockets.get_mut(user_id).unwrap();
        let old_chats = user_socket.chats.to_owned();
        user_socket.channel.retain(|c| !tx.same_channel(c));
        let mut last_seen_s = None;
        if user_socket.channel.is_empty() {
            last_seen_s = Some(
                std::time::SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("TIME TRAVEL>!!?!?!")
                    .as_secs(),
            );
            user_socket.chats = vec![]; // to free the ram right away. (clear() function does not free the ram.)
            user_socket.online = false;
            user_socket.last_seen_s = last_seen_s;
        }
        (user_socket.channel.is_empty(), old_chats, last_seen_s)
    };
    if has_no_clients {
        // Collect the chats that are to be removed after cleaning up the users
        let chats_to_remove: Vec<&str> = user_chats
            .iter()
            .filter_map(|chat| {
                state.chats.get_mut(chat).and_then(|mut users| {
                    users.retain(|id| id != user_id);
                    if users.is_empty() {
                        Some(chat.as_str())
                    } else {
                        None
                    }
                })
            })
            .collect();

        // Remove the chats that are now empty
        for chat in chats_to_remove {
            state.chats.remove(chat);
        }

        let friend_ids = user::get_friend_ids(&state.db, user_id).await.unwrap();
        state.emit_user_online(user_id, &friend_ids, false, last_seen_s);
    }

    debug!(
        "Client {} disconnected. has_no_clients: {}",
        user_id, has_no_clients
    )
}

pub fn emit_new_message(state: &AppState, message: &MessageSaveResponse) {
    state.emit_chat_data(
        //TODO: make it so that the sender socket doesn't receive the message.
        &message.chat_id,
        json!({
            "event": "ChatNewMessage",
            "data": message
        }),
    );
}

// TODO: Test this
pub fn leave_direct_chat(state: &AppState, users: &[&str], chat_id: &str) {
    for user_id in users {
        if let Some(mut user) = state.sockets.get_mut(*user_id) {
            user.chats.retain(|id| id != chat_id);
        }
    }
    state.chats.remove(chat_id);
}

pub fn emit_new_direct_chat_join(state: &AppState, users: Vec<String>, chat: &ChatJson) {

    for user_id in &users {
        if let Some(mut user) = state.sockets.get_mut(user_id) {
            user.chats.push(chat.id.to_owned());
        }
    }
    state.chats.insert(chat.id.to_owned(), users);
    state.emit_chat_data(&chat.id, serde_json::to_value(chat).unwrap());

}

pub fn emit_friend_added(state: &AppState, user_id: &str, receiver_user_id: &str, chat: &ChatJson) {
    if let Some(user) = state.sockets.get(user_id) {
        match state.sockets.get(receiver_user_id) {
            Some(receiver_user) => {
                user.send_json(&json!({
                    "event": "UserUpdate",
                    "data": {
                       "user": {
                        "id": receiver_user_id,
                        "relationship": RelationStatus::Friend,
                        "online": receiver_user.online,
                        "lastSeen": receiver_user.last_seen_s
                       },
                    }
                }));
            }
            None => {
                user.send_json(&json!({
                    "event": "UserUpdate",
                    "data": {
                       "user": {
                        "id": receiver_user_id,
                        "relationship": RelationStatus::Friend,
                        "online": false
                       },
                    }
                }));
            }
        }
    }
    if let Some(receiver_user) = state.sockets.get(receiver_user_id) {
        match state.sockets.get(user_id) {
            Some(user) => {
                receiver_user.send_json(&json!({
                    "event": "UserUpdate",
                    "data": {
                       "user": {
                        "id": user_id,
                        "relationship": RelationStatus::Friend,
                        "online": user.online,
                        "lastSeen": user.last_seen_s
                       },
                    }
                }));
            }
            None => {
                receiver_user.send_json(&json!({
                    "event": "UserUpdate",
                    "data": {
                       "user": {
                        "id": user_id,
                        "relationship": RelationStatus::Friend,
                        "online": false
                       },
                    }
                }));
            }
        }
    };
    emit_new_direct_chat_join(state, vec![user_id.to_owned(), receiver_user_id.to_owned()], chat);
}
pub fn emit_new_friend_request(
    state: &AppState,
    user_id: &str,
    username: &str,
    receiver_id: &str,
    receiver_username: &str,
) {
    if let Some(user) = state.sockets.get(receiver_id) {
        user.send_json(&json!({
            "event": "UserUpdate",
            "data": {
               "user": {
                "id": user_id,
                "username": username,
                "relationship": RelationStatus::Incoming,
               },
            }
        }));
    };
    if let Some(user) = state.sockets.get(user_id) {
        user.send_json(&json!({
            "event": "UserUpdate",
            "data": {
               "user": {
                "id": receiver_id,
                "username": receiver_username,
                "relationship": RelationStatus::Outgoing,
               },
            }
        }));
    };
}

pub fn emit_friend_removed(
    state: &AppState,
    user_id: &str,
    receiver_user_id: &str,
    message: &str,
    chat_id: &Option<String>,
) {
    if let Some(id) = chat_id {
        leave_direct_chat(state, &[user_id, receiver_user_id], id)
    }

    if let Some(user) = state.sockets.get(user_id) {
        user.send_json(&json!({
            "event": "UserUpdate",
            "data": {
               "user": {
                "id": receiver_user_id,
                "relationship": RelationStatus::None,
                "online": false
               },
               "message": message
            }
        }));
    }

    if let Some(user) = state.sockets.get(receiver_user_id) {
        user.send_json(&json!({
            "event": "UserUpdate",
            "data": {
               "user": {
                "id": user_id,
                "relationship": RelationStatus::None,
                "online": false
               },
               "message": message
            }
        }));
    };
}
impl AppState {
    pub fn emit_chat_data(&self, chat_id: &str, data: serde_json::Value) {
        if let Some(users) = self.chats.get(chat_id) {
            for user_id in users.iter() {
                if let Some(socket) = self.sockets.get(user_id) {
                    socket.send_json(&data);
                }
            }
        }
    }
    pub fn emit_chat_data_except(&self, chat_id: &str, data: serde_json::Value, except: &str) {
        if let Some(users) = self.chats.get(chat_id) {
            for user_id in users.iter() {
                if user_id != except {
                    if let Some(socket) = self.sockets.get(user_id) {
                        socket.send_json(&data);
                    }
                }
            }
        }
    }
    pub fn user_perm_chat_exists(&self, user_id: &str, chat_id: &str) -> bool {
        if let Some(user) = self.sockets.get(user_id) {
            user.chats.contains(&chat_id.to_owned())
        } else {
            false
        }
    }
    pub fn emit_user_online(
        &self,
        user_id: &str,
        recipients: &Vec<String>,
        is_online: bool,
        last_seen_s: Option<u64>,
    ) {
        for recipient in recipients {
            if let Some(socket) = self.sockets.get(recipient) {
                socket.send_json(&json!({
                    "event": "UserUpdate",
                    "data": {
                        "user": {
                            "id": user_id,
                            "online": is_online,
                            "lastSeen": last_seen_s
                        }
                    }
                }));
            }
        }
    }
}

#[derive(Deserialize)]
struct AuthReq {
    event: String,
    token: String,
}

// temporary measure
#[derive(Deserialize)]
struct WsInput {
    event: String,
    data: String,
}
