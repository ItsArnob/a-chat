use anyhow::Context;
use futures_util::TryStreamExt;
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};

use crate::{database::Database, util::result::ApiResult};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    #[serde(rename(deserialize = "_id"))]
    pub id: String,
    pub chat_type: ChatType,
    pub recipients: Vec<ChatRecipient>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRecipient {
    pub id: String,
}
#[derive(Debug, Serialize, Deserialize)]
pub enum ChatType {
    Direct,
    Group,
}

impl ToString for ChatType {
    fn to_string(&self) -> String {
        match self {
            ChatType::Direct => "Direct".to_string(),
            ChatType::Group => "Group".to_string(),
        }
    }
}

pub async fn get_chats_of_user(db: &Database, user_id: &str) -> ApiResult<Vec<Chat>> {
    let chats = db
        .chats::<Chat>()
        .find(
            doc! {
                "recipients.id": user_id
            },
            None,
        )
        .await
        .context("get_chats_of_user: failed to retrieve chats of user.")?;

    let chats = chats
        .try_collect::<Vec<_>>()
        .await
        .context("get_chats_of_user: failed to iterate over cursor.")?;

    Ok(chats)
}
