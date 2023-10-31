use crate::{
    database::Database,
    routes::chat::MessageJson,
    util::result::{ApiError, ApiResult},
};
use anyhow::{anyhow, Context};
use futures_util::{FutureExt, TryStreamExt};
use mongodb::{bson::doc, options::FindOptions};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use super::{
    chat::Chat,
    user::{self, RelationStatus},
};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    #[serde(rename = "_id")]
    pub id: String,
    pub chat_id: String,
    pub author_id: String,
    pub content: String,
}

pub async fn get_messages_by_id(db: &Database, m_ids: &[&str]) -> ApiResult<Vec<MessageJson>> {
    let mut messages_cur = db
        .messages::<Message>()
        .find(
            doc! {
                "_id": {
                    "$in": m_ids
                }
            },
            None,
        )
        .await
        .context("get_messages_by_id: Failed to find messages.")?;

    let mut messages = Vec::new();

    while let Some(message) = messages_cur
        .try_next()
        .await
        .context("get_messages_by_id: Failed to get next message from cursor.")?
    {
        let timestamp = Ulid::from_string(message.id.as_str())
            .context("get_messages_by_id: invalid ulid found while parsing from cursor.")?
            .timestamp_ms();
        messages.push(MessageJson {
            id: message.id,
            chat_id: message.chat_id,
            author_id: message.author_id,
            content: message.content,
            timestamp,
        });
    }
    Ok(messages)
}
pub async fn get_messages(
    db: &Database,
    user_id: &str,
    chat_id: &str,
    before: &Option<String>,
    after: &Option<String>,
    limit: i64,
) -> ApiResult<Vec<MessageJson>> {
    let chat = db
        .chats::<Chat>()
        .find_one(
            doc! {
                "_id": chat_id
            },
            None,
        )
        .await
        .context("get_messages: Failed to find chat.")?;

    let chat = match chat {
        Some(chat) => chat,
        None => return Err(ApiError::ChatNotFound),
    };

    if !chat.recipients.iter().any(|r| r.id == user_id) {
        return Err(ApiError::ChatReadPermissionDenied);
    }

    let mut query = doc! {
        "chatId": chat_id
    };

    if let Some(before) = before {
        query.insert(
            "_id",
            doc! {
                "$lt": before
            },
        );
    } else if let Some(after) = after {
        query.insert(
            "_id",
            doc! {
                "$gt": after
            },
        );
    }

    let mut messages_cur = db
        .messages::<Message>()
        .find(
            query,
            FindOptions::builder()
                .sort(doc! {
                    "_id": -1
                })
                .limit(limit)
                .build(),
        )
        .await
        .context("get_messages: Failed to find messages.")?;

    let mut messages = Vec::new();

    while let Some(message) = messages_cur
        .try_next()
        .await
        .context("get_messages: Failed to get next message from cursor.")?
    {
        let timestamp = Ulid::from_string(message.id.as_str())
            .context("get_messages: invalid ulid found while parsing from cursor.")?
            .timestamp_ms();
        messages.push(MessageJson {
            id: message.id,
            chat_id: message.chat_id,
            author_id: message.author_id,
            content: message.content,
            timestamp,
        });
    }

    Ok(messages)
}

pub async fn save_direct_message(
    db: &Database,
    author_id: &str,
    chat_id: &str,
    content: &str,
) -> ApiResult<MessageJson> {
    let chat = db
        .chats::<Chat>()
        .find_one(
            doc! {
                "_id": chat_id
            },
            None,
        )
        .await
        .context("save_direct_message: Failed to find chat.")?;

    let chat = match chat {
        Some(chat) => chat,
        None => return Err(ApiError::ChatNotFound),
    };
    if chat.recipients.len() != 2 {
        return Err(ApiError::ChatWritePermissionDenied);
    }

    // TODO: changed r.id == *author_id to r.id == author_id. check on this if it has the same effect.
    chat.recipients
        .iter()
        .find(|r| r.id == author_id)
        .ok_or(ApiError::ChatWritePermissionDenied)?;
    let other_user_id = &chat
        .recipients
        .iter()
        .find(|r| r.id != author_id)
        .ok_or(ApiError::UnknownError(anyhow!(
            "save_direct_message: No other user found in chat, only the authors id exists."
        )))?
        .id;
    let user_relations = user::find_relations_of_user(db, author_id).await?;

    let relation_to_user = user_relations
        .iter()
        .find(|r| r.id == *other_user_id)
        .ok_or(ApiError::ChatWritePermissionDenied)?;
    if relation_to_user.status != RelationStatus::Friend {
        return Err(ApiError::ChatWritePermissionDenied);
    }

    let mid = Ulid::new();
    let message = Message {
        id: mid.to_string(), // TODO: make monotonic
        chat_id: chat_id.to_string(),
        author_id: author_id.to_string(),
        content: content.trim().to_string(),
    };

    let mut session = db
        .client
        .start_session(None)
        .await
        .context("save_direct_message: Failed to start session.")?;
    session
        .with_transaction(
            (&db.chats::<Chat>(), &db.messages::<Message>(), &message),
            |session, (chats, messages, msg)| {
                async move {
                    messages
                        .insert_one_with_session(*msg, None, session)
                        .await?;
                    chats
                        .update_one_with_session(
                            doc! {
                                "_id": &chat_id
                            },
                            doc! {
                                "$set": {
                                    "lastMessageId": &msg.id
                                }
                            },
                            None,
                            session,
                        )
                        .await?;

                    Ok(())
                }
                .boxed()
            },
            None,
        )
        .await
        .context("save_direct_message: Failed to execute transaction.")?;
    Ok(MessageJson {
        id: message.id,
        chat_id: message.chat_id,
        author_id: message.author_id,
        content: message.content,
        timestamp: mid.timestamp_ms(),
    })
}
