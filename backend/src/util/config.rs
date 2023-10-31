use super::constants::{API_DEFAULT_HOST, API_DEFAULT_PORT};
use anyhow::{Context, Result};
use http::header;
use std::{env, net::SocketAddr};
use tracing::*;

#[derive(Clone, Debug)]
pub struct ApiConfig {
    pub database_url: String,
    pub socket_address: SocketAddr,
    pub db_name: String,
    pub cors_origins: Vec<header::HeaderValue>,
    // pub argon_params: Params,
}

impl ApiConfig {
    pub fn init() -> Result<ApiConfig> {
        let args: Vec<String> = env::args().collect();

        if args.len() >= 2 {
            info!("Trying to load .env file from path: {}", &args[1]);
            dotenvy::from_path(&args[1]).context(format!(
                "Failed to load the .env file from path: {}",
                &args[1]
            ))?;
            info!("Loaded .env file from path: {}", &args[1]);
        } else {
            info!("Trying to find .env file from current and parent directories.");

            match dotenvy::dotenv() {
                Ok(path) => info!("Loaded .env file from path: {}", path.display()),
                Err(_) => {
                    info!("No .env file found. using environment variables from shell only.")
                }
            }
        };

        let host = env::var("HOST").unwrap_or_else(|_| {
            debug!("HOST variable is not set. using default: {API_DEFAULT_HOST}");
            API_DEFAULT_HOST.into()
        });

        let port = env::var("PORT").unwrap_or_else(|_| {
            debug!("PORT variable is not set. using default: {API_DEFAULT_PORT}");
            API_DEFAULT_PORT.into()
        });

        // let argon_m_cost = match env::var("ARGON_M_COST") {
        //     Ok(val) => val.parse().context("Failed to parse ARGON_M_COST as int.")?,
        //     Err(_) => {
        //         debug!("ARGON_M_COST variable is not set. using default: {}", Params::DEFAULT_M_COST);
        //         Params::DEFAULT_M_COST
        //     }
        // };

        // let argon_t_cost = match env::var("ARGON_T_COST") {
        //     Ok(val) => val.parse().context("Failed to parse ARGON_T_COST as int.")?,
        //     Err(_) => {
        //         debug!("ARGON_T_COST variable is not set. using default: {}", Params::DEFAULT_T_COST);
        //         Params::DEFAULT_T_COST
        //     }
        // };

        // let argon_p_cost = match env::var("ARGON_P_COST") {
        //     Ok(val) => val.parse().context("Failed to parse ARGON_P_COST as int.")?,
        //     Err(_) => {
        //         debug!("ARGON_P_COST variable is not set. using default: {}", Params::DEFAULT_P_COST);
        //         Params::DEFAULT_P_COST
        //     }
        // };

        // let argon_params = match Params::new(argon_m_cost, argon_t_cost, argon_p_cost, None) {
        //     Ok(params) => params,
        //     Err(error) => {
        //         bail!("Failed to construct argon2 params: {}",error)
        //     }
        // };

        let mut cors_origins: Vec<header::HeaderValue> = Vec::new();
        for origin in env::var("CORS_ORIGINS").unwrap_or_default().split(' ') {
            let value = header::HeaderValue::from_str(origin).context(format!("Error occured when converting a cors origin to HeaderValue. problematic domain: {}", origin))?;
            cors_origins.push(value);
        }
        let config = Self {
            database_url: env::var("DATABASE_URL")
                .context("Missing DATABASE_URL environment variable.")?,
            socket_address: format!("{host}:{port}")
                .parse()
                .context("HOST and/or PORT environment variables contain invalid data.")?,
            cors_origins,
            db_name: env::var("DATABASE_NAME")
                .context("Missing DATABASE_NAME environment variable.")?,
            // argon_params,
        };
        Ok(config)
    }
}
