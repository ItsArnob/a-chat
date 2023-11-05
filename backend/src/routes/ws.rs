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

// TODO: return socket error response as { event: "Error", data: {} }
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
                handle_disconnect(&state, &data.id, tx);
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
    let friend_ids: Vec<&str> = data
        .users
        .iter()
        .filter_map(|user| {
            if let Some(RelationStatus::Friend) = user.relationship {
                Some(user.id.as_str())
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
                .any(|recipient| friend_ids.contains(&recipient.id.as_str()))
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

    // this is just an example of how to send data to the client.
    while let Some(msg) = stream.next().await {
        if let Ok(Message::Text(text)) = msg {
            // unwrapping it because this is impossible. data was inserted before this code. (unless the hashmap was modified somewhere else???)
            let user_socket = state.sockets.get(&data.id).unwrap();
            user_socket.send_json(&json!({ "data": text }));
        }
    }

    tx
}

fn handle_disconnect(state: &AppState, user_id: &str, tx: UnboundedSender<String>) {
    // making a copy because we dont want to keep the sockets dashmap locked for long.
    let (has_no_clients, user_chats) = {
        // unwrapping it because this is impossible. data was inserted before this code. (unless the hashmap was modified somewhere else???)

        let mut user_socket = state.sockets.get_mut(user_id).unwrap();
        let old_chats = user_socket.chats.to_owned();
        user_socket.channel.retain(|c| !tx.same_channel(c));
        if user_socket.channel.is_empty() {
            user_socket.chats = vec![]; // to free the ram right away. (clear() function does not free the ram.)
            user_socket.online = false;
            user_socket.last_seen_s = Some(
                std::time::SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("TIME TRAVEL>!!?!?!")
                    .as_secs(),
            );
        }
        (user_socket.channel.is_empty(), old_chats)
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
    }

    debug!(
        "Client {} disconnected. has_no_clients: {}",
        user_id, has_no_clients
    )
}
#[derive(Deserialize)]
struct AuthReq {
    event: String,
    token: String,
}
