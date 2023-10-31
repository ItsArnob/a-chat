use anyhow::Result;
use axum::{async_trait, extract::FromRequestParts};
use http::request::Parts;
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::util::result::ApiError;

pub struct Query<T>(pub T);

#[async_trait]
impl<S, T> FromRequestParts<S> for Query<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = ApiError;
    async fn from_request_parts(req: &mut Parts, state: &S) -> Result<Self, ApiError> {
        match axum::extract::Query::<T>::from_request_parts(req, state).await {
            Ok(value) => match value.validate() {
                Ok(_) => Ok(Query(value.0)),
                Err(errors) => Err(ApiError::ValidationError(errors)),
            },

            Err(rejection) => Err(ApiError::QueryStringError(rejection)),
        }
    }
}
