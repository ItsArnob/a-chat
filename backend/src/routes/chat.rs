use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::{
    app::AppState,
    database::models::message,
    util::{
        extractors::{auth::AuthUser, json::JsonExtractor, query::Query},
        result::ApiResult,
    },
};

use super::ws;

pub fn build_router() -> Router<AppState> {
    Router::new().route(
        "/:chatId/messages",
        get(get_messages).post(save_direct_message),
    )
}

async fn get_messages(
    State(state): State<AppState>,
    Path(chat_id): Path<String>,
    Query(query): Query<GetMessagesQuery>,
    auth: AuthUser,
) -> ApiResult<Json<Vec<MessageJson>>> {
    let messages = message::get_messages(
        &state.db,
        &auth.id,
        &chat_id,
        &query.before,
        &query.after,
        query.limit.unwrap_or(50),
    )
    .await?;

    Ok(Json(messages))
}

async fn save_direct_message(
    State(state): State<AppState>,
    Path(chat_id): Path<String>,
    auth: AuthUser,
    JsonExtractor(body): JsonExtractor<SaveMessageRequest>,
) -> ApiResult<Json<MessageSaveResponse>> {
    let message =
        message::save_direct_message(&state.db, &auth.id, &chat_id, &body.content).await?;
    let message_response = MessageSaveResponse {
        id: message.id,
        chat_id: message.chat_id,
        author_id: message.author_id,
        content: message.content,
        timestamp: message.timestamp,
        ack_id: body.ack_id,
    };
    ws::emit_new_message(&state, &message_response);
    Ok(Json(message_response))
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageJson {
    #[serde(rename(deserialize = "_id"))]
    pub id: String,
    pub chat_id: String,
    pub author_id: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Deserialize, Serialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct SaveMessageRequest {
    #[validate(length(
        min = 1,
        max = 1024,
        message = "Must be between 1 and 1024 characters long."
    ))]
    pub content: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[validate(length(equal = 26, message = "Invalid id."))]
    ack_id: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSaveResponse {
    pub id: String,
    pub chat_id: String,
    pub author_id: String,
    pub content: String,
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ack_id: Option<String>,
}

#[derive(Deserialize, Validate)]
pub struct GetMessagesQuery {
    #[validate(length(equal = 26, message = "Invalid id."))]
    pub before: Option<String>,
    #[validate(length(equal = 26, message = "Invalid id."))]
    pub after: Option<String>,
    #[validate(range(min = 1, max = 50, message = "Must be between 1 and 50."))]
    pub limit: Option<i64>,
}
