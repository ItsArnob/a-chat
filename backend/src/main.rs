use std::process;

use tracing::*;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use util::{config::ApiConfig, constants::EVENT_SYS_CRASH};
mod app;
mod database;
mod routes;
mod util;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or("api=debug,data_layer=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = ApiConfig::init().unwrap_or_else(|error| {
        error!(event = format!("{EVENT_SYS_CRASH}:config"), description = ?error);
        process::exit(1);
    });
    let app = app::build(&config).await.unwrap_or_else(|error| {
        error!(event = format!("{EVENT_SYS_CRASH}:mongodb"), description = %error);
        process::exit(1);
    });

    info!("Listening on {}", &config.socket_address);
    axum::Server::bind(&config.socket_address)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
