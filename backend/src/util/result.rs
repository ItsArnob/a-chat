use tracing::*;

use super::constants::EVENT_SYS_INTERNAL_ERROR;

use axum::{
    extract::rejection::{JsonRejection, QueryRejection},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
pub use validator::ValidationErrors;

type OptionalValidationErrors = Option<Vec<ValidationError>>;
pub type ApiResult<T, E = ApiError> = Result<T, E>;

#[derive(Debug)]
pub enum ApiError {
    UnknownError(anyhow::Error),
    JsonError(JsonRejection),
    ValidationError(ValidationErrors),
    DuplicateUser(Option<String>),
    QueryStringError(QueryRejection),
    Unauthorized,
    InvalidCredentials,
    UserNotFound,
    CantAddSelf,
    AlreadyFriends,
    AlreadySentFR,
    BlockedByOtherFriend,
    BlockedFriend,
    CantRemoveSelf,
    ChatNotFound,
    ChatReadPermissionDenied,
    ChatWritePermissionDenied,
}

impl From<anyhow::Error> for ApiError {
    fn from(error: anyhow::Error) -> Self {
        Self::UnknownError(error)
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponseMessage {
    message: String,
    status_code: u16,
    error: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    validation_errors: OptionalValidationErrors,
}

#[derive(serde::Serialize)]
pub struct ValidationError {
    field: String,
    errors: Vec<String>,
}

impl ApiError {
    pub fn json(&self, validation_errors: OptionalValidationErrors) -> serde_json::Value {
        json!(ErrorResponseMessage {
            message: self.error_description(),
            status_code: self.status_code().as_u16(),
            error: self
                .status_code()
                .canonical_reason()
                .unwrap_or("Unknown status code."),
            validation_errors
        })
    }

    pub fn get_response(&self, validation_errors: OptionalValidationErrors) -> Response {
        (self.status_code(), Json(self.json(validation_errors))).into_response()
    }

    pub fn status_code(&self) -> StatusCode {
        match self {
            // TODO: test this by intentionally returning an db error in a route with .context()
            ApiError::UnknownError(_) => StatusCode::INTERNAL_SERVER_ERROR,

            ApiError::JsonError(error) => match error {
                JsonRejection::JsonDataError(_) | JsonRejection::JsonSyntaxError(_) => {
                    StatusCode::BAD_REQUEST
                }
                JsonRejection::MissingJsonContentType(_) => StatusCode::UNSUPPORTED_MEDIA_TYPE,
                _ => StatusCode::IM_A_TEAPOT,
            },

            ApiError::ValidationError(_) | ApiError::QueryStringError(_) => StatusCode::BAD_REQUEST,
            ApiError::DuplicateUser(_)
            | ApiError::CantAddSelf
            | ApiError::AlreadyFriends
            | ApiError::AlreadySentFR
            | ApiError::BlockedByOtherFriend
            | ApiError::BlockedFriend
            | ApiError::CantRemoveSelf => StatusCode::CONFLICT,
            ApiError::Unauthorized | ApiError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            ApiError::UserNotFound | ApiError::ChatNotFound => StatusCode::NOT_FOUND,
            ApiError::ChatReadPermissionDenied | ApiError::ChatWritePermissionDenied => {
                StatusCode::FORBIDDEN
            }
        }
    }

    pub fn error_description(&self) -> String {
        match self {
            ApiError::UnknownError(_) => "Unknown error occurred.".to_string(),
            ApiError::JsonError(_) => "Invalid JSON request or missing fields.".to_string(),
            ApiError::QueryStringError(_) => "Invalid query string.".to_string(),
            ApiError::ValidationError(_) => {
                "Validation error occurred in the following fields.".to_string()
            }
            ApiError::DuplicateUser(reason) => reason
                .to_owned()
                .unwrap_or("User already exists.".to_string()),
            ApiError::Unauthorized => "Invalid session token.".to_string(),
            ApiError::InvalidCredentials => "Invalid username or password.".to_string(),
            ApiError::UserNotFound => "User not found.".to_string(),
            ApiError::CantAddSelf => "You can't add yourself as a friend.".to_string(),
            ApiError::AlreadyFriends => "You are already friends with this user.".to_string(),
            ApiError::AlreadySentFR => {
                "You have already sent a friend request to this user.".to_string()
            }
            ApiError::BlockedByOtherFriend => "You are blocked by this user.".to_string(),
            ApiError::BlockedFriend => "You blocked this user.".to_string(),
            ApiError::CantRemoveSelf => "You can't remove yourself.".to_string(),
            ApiError::ChatNotFound => "Chat not found.".to_string(),
            ApiError::ChatReadPermissionDenied => {
                "You don't have permission to read messages of this chat.".to_string()
            }
            ApiError::ChatWritePermissionDenied => {
                "You don't have permission to send messages in this chat.".to_string()
            }
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            Self::UnknownError(ref error) => {
                if error.is::<mongodb::error::Error>() {
                    error!(event = format!("{EVENT_SYS_INTERNAL_ERROR}:mongodb"), description = ?error);
                } else {
                    error!(event = format!("{EVENT_SYS_INTERNAL_ERROR}:unknown"), description = ?error);
                }
                self.get_response(None)
            }

            Self::ValidationError(ref error) => {
                let errors = error.field_errors();
                let mut validation_errors: Vec<ValidationError> = Vec::new();

                for (field, error_messages) in errors {
                    let mut field_errors: Vec<String> = Vec::new();

                    for error in error_messages {
                        if let Some(message) = &error.message {
                            field_errors.push(message.to_string());
                        }
                    }

                    validation_errors.push(ValidationError {
                        field: field.to_string(),
                        errors: field_errors,
                    })
                }

                self.get_response(Some(validation_errors))
            }
            _ => self.get_response(None),
        }
    }
}
