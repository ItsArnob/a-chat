use crate::{
    database::Database,
    routes::{self, ws::ws_handler},
    util::config::ApiConfig,
};
use axum::{routing::get, Router};
use dashmap::DashMap;
use http::{header, Method};
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::warn;

#[derive(Default)]
pub struct UserSocket {
    pub online: bool,
    pub last_seen_s: Option<u64>,
    pub channel: Vec<mpsc::UnboundedSender<String>>,
    pub chats: Vec<String>,
}

impl UserSocket {
    pub fn send_json(&self, data: &serde_json::Value) {
        for channel in &self.channel {
            if let Err(err) = channel.send(data.to_string()) {
                warn!("Failed to send JSON data to client: {}", err);
            }
        }
    }
}
#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub sockets: Arc<DashMap<String, UserSocket>>,
    pub chats: Arc<DashMap<String, Vec<String>>>,
}

pub async fn build(config: &ApiConfig) -> Result<Router<()>, mongodb::error::Error> {
    let db = Database::connect(config).await?;
    let state = AppState {
        db,
        sockets: Arc::new(DashMap::new()),
        chats: Arc::new(DashMap::new()),
    };

    Ok(Router::new()
        .nest("/auth", routes::auth::build_router())
        .nest("/users", routes::users::build_router())
        .nest("/chat", routes::chat::build_router())
        .route("/ws", get(ws_handler))
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_credentials(true)
                .allow_origin(config.cors_origins.to_owned())
                .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PUT])
                .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]),
        )
        .with_state(state))
}
