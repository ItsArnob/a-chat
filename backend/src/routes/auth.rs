use axum::routing::get;
use axum::{
    extract::State,
    routing::{delete, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use validator::Validate;

use crate::database::models::session;
use crate::util::extractors::auth::AuthUser;
use crate::{app::AppState, util::extractors::json::JsonExtractor, util::result::ApiResult};

use crate::{database::models::user, util::constants::USERNAME_REGEX};

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/signup", post(create_user))
        .route("/user", get(get_user))
        .route("/login", post(login))
        .route("/logout", delete(logout))
}

#[axum::debug_handler]
async fn create_user(
    State(state): State<AppState>,
    JsonExtractor(body): JsonExtractor<UserCredentialsRequest>,
) -> ApiResult<Json<CreateUserResponse>> {
    let user_id = user::create_user(&state.db, &body.username, &body.password).await?;
    Ok(Json(CreateUserResponse {
        id: user_id,
        username: body.username,
    }))
}

#[axum::debug_handler(state = AppState)]
async fn get_user(auth: AuthUser) -> Json<GetUserResponse> {
    Json(GetUserResponse {
        id: auth.id,
        username: auth.username,
    })
}

async fn login(
    State(state): State<AppState>,
    JsonExtractor(body): JsonExtractor<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    let user = user::validate_user(&state.db, &body.username, &body.password).await?;
    let session = session::create_session(&state.db, &user.id, body.friendly_name).await?;

    Ok(Json(LoginResponse {
        id: user.id,
        username: user.username,
        session: SessionLoginResponse {
            id: session.id,
            token: session.token,
        },
    }))
}

#[axum::debug_handler(state = AppState)]
async fn logout(State(state): State<AppState>, auth: AuthUser) -> ApiResult<Json<Value>> {
    session::delete_session(&state.db, &auth.session.id).await?;

    Ok(Json(json!({
        "message": "Successfully logged out."
    })))
}

#[derive(Serialize)]
struct LoginResponse {
    id: String,
    username: String,
    session: SessionLoginResponse,
}
#[derive(Serialize)]
struct SessionLoginResponse {
    id: String,
    token: String,
}
#[derive(Deserialize, Serialize)]
struct GetUserResponse {
    id: String,
    username: String,
}

#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
struct LoginRequest {
    #[validate(length(max = 32, message = "Must be atmost 32 characters long."))]
    username: String,
    #[validate(length(min = 8, message = "Must be atleast 8 characters long."))]
    password: String,
    #[validate(length(
        min = 1,
        max = 100,
        message = "Must be between 1 and 100 characters long."
    ))]
    friendly_name: Option<String>,
}
#[derive(Deserialize, Serialize, Validate)]
struct UserCredentialsRequest {
    #[validate(
        length(
            min = 3,
            max = 32,
            message = "Must be atleast 3 characters long and atmost 32 characters long."
        ),
        regex(
            path = "USERNAME_REGEX",
            message = "Must be made up of english alphabets, numbers, hyphens and underscores."
        )
    )]
    username: String,
    #[validate(length(min = 8, message = "Must be atleast 8 characters long."))]
    password: String,
}

#[derive(serde::Serialize)]
struct CreateUserResponse {
    id: String,
    username: String,
}
