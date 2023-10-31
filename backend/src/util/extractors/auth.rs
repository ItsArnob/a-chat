use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
};
use http::request::Parts;

use crate::{app::AppState, database::models::session, util::result::ApiError};

pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub session: session::Session,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        req: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let db = AppState::from_ref(state).db;
        let auth_header = req.headers.get("Authorization");
        let auth_header = match auth_header {
            Some(header) => header,
            None => return Err(ApiError::Unauthorized),
        };

        let auth_header = match auth_header.to_str() {
            Ok(header) => header,
            Err(_) => return Err(ApiError::Unauthorized),
        };
        let auth_header = auth_header.split_whitespace().collect::<Vec<&str>>();
        if auth_header.len() != 2 || auth_header[0] != "Bearer" {
            return Err(ApiError::Unauthorized);
        }
        let token = auth_header[1];
        let account = session::validate_token(&db, token).await?;
        // TODO: "Touch" session to update its expiration date
        Ok(account)
    }
}
