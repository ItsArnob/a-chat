use anyhow::Context;
use mongodb::bson::{doc, DateTime};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::{
    database::Database,
    util::{
        extractors::auth::AuthUser,
        result::{ApiError, ApiResult},
    },
};

use super::user::{self, User};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    #[serde(rename = "_id")]
    pub id: String,
    pub token: String,
    pub user_id: String,
    pub expires_at: DateTime,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}
pub async fn get_user_from_token(db: &Database, token: &str) -> ApiResult<(String, User)> {
    let session = db
        .sessions::<Session>()
        .find_one(
            doc! {
                "token": &token
            },
            None,
        )
        .await
        .context("get_user_from_token: Failed to find session.")?;
    let session = match session {
        Some(session) => session,
        None => return Err(ApiError::Unauthorized),
    };

    let user = user::find_user_by_id(db, &session.user_id).await?;
    match user {
        Some(user) => {
            touch_session(db, &session.id).await?;
            Ok((session.id, user))
        }
        None => Err(ApiError::Unauthorized),
    }
}
pub async fn validate_token(db: &Database, token: &str) -> ApiResult<AuthUser> {
    let session = db
        .sessions::<Session>()
        .find_one(
            doc! {
                "token": &token
            },
            None,
        )
        .await
        .context("validate_token: Failed to find session.")?;
    let session = match session {
        Some(session) => session,
        None => return Err(ApiError::Unauthorized),
    };

    let user = user::find_account_by_id(db, &session.user_id).await?;
    match user {
        Some(user) => {
            touch_session(db, &session.id).await?;
            Ok(AuthUser {
                id: user.id,
                username: user.username,
                password_hash: user.password_hash,
                session,
            })
        }
        None => Err(ApiError::Unauthorized),
    }
}
pub async fn create_session(
    db: &Database,
    user_id: &str,
    name: Option<String>,
) -> ApiResult<Session> {
    let token = nanoid::nanoid!(50);
    let id = Ulid::new().to_string();
    let session = Session {
        id,
        token,
        user_id: user_id.to_string(),
        expires_at: DateTime::from_millis(
            DateTime::now().timestamp_millis() + 30 * 24 * 60 * 60 * 1000,
        ), // TODO: use the config to get this max age.
        name,
    };

    db.sessions::<Session>()
        .insert_one(&session, None)
        .await
        .context("create_session: Failed to insert session.")?;

    Ok(session)
}

pub async fn touch_session(db: &Database, sid: &str) -> ApiResult<()> {
    db.sessions::<Session>().update_one(
        doc! {
            "_id": sid
        },
        doc! {
            "$set": {
                "expiresAt": DateTime::from_millis(DateTime::now().timestamp_millis() + 30 * 24 * 60 * 60 * 1000)
            }
        },
        None
    ).await.context("touch_session: Failed to update session.")?;
    Ok(())
}

pub async fn delete_session(db: &Database, sid: &str) -> ApiResult<()> {
    db.sessions::<Session>()
        .delete_one(doc! { "_id": sid }, None)
        .await
        .context("delete_session: Failed to delete session.")?;
    Ok(())
}
