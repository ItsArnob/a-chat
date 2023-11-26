use std::collections::HashMap;

use axum::extract::{Path, Query};

use axum::{extract::State, routing::put, Json, Router};
use serde::Serialize;

use crate::database::models::chat::{Chat, ChatRecipient, ChatType};

use crate::util::extractors::auth::AuthUser;
use crate::{app::AppState, util::result::ApiResult};

use crate::database::models::user;

use super::ws;

pub fn build_router() -> Router<AppState> {
    Router::new().route(
        "/:usernameOrId/friend",
        put(add_friend).delete(remove_friend),
    )
}

async fn add_friend(
    State(state): State<AppState>,
    Path(username_or_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    auth: AuthUser,
) -> ApiResult<Json<AddFriendResponse>> {
    let is_id = match params.get("type") {
        Some(t) => t.to_ascii_lowercase() == "id",
        None => false,
    };
    let result = user::add_friend(&state.db, &username_or_id, &auth.id, is_id).await?;

    match result.chat {
        None => {
            ws::emit_new_friend_request(&state, &auth.id, &auth.username, &result.user.id, &result.user.username)
        }
        Some(ref chat) => {
            ws::emit_friend_added(&state, &auth.id, &result.user.id, chat)
        } 
    }
    Ok(Json(result))
}

async fn remove_friend(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    auth: AuthUser,
) -> ApiResult<Json<RemoveFriendResponse>> {
    let result = user::remove_friend(&state.db, &user_id, &auth.id).await?;
    ws::emit_friend_removed(&state, &auth.id, &user_id, &result.message, &result.chat_id);
    Ok(Json(result))
}

#[derive(Serialize)]
pub struct AddFriendResponse {
    pub user: AddFriendUser,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat: Option<ChatJson>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveFriendResponse {
    pub user: RemoveFriendUser,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatJson {
    pub id: String,
    pub chat_type: ChatType,
    pub recipients: Vec<ChatRecipient>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_id: Option<String>,
}
// TODO: i dont remember why i need this. investigate.
impl From<Chat> for ChatJson {
    fn from(chat: Chat) -> Self {
        ChatJson {
            id: chat.id,
            chat_type: chat.chat_type,
            recipients: chat.recipients,
            last_message_id: chat.last_message_id,
        }
    }
}
#[derive(Serialize)]
pub struct AddFriendUser {
    pub id: String,
    pub username: String,
}

#[derive(Serialize)]
pub struct RemoveFriendUser {
    pub id: String,
}
