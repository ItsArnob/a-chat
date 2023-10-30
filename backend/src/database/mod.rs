pub mod models;
use mongodb::{bson::doc, options::ClientOptions, Client, Collection, Database as MongoDatabase};

use crate::util::config::ApiConfig;

#[derive(Clone)]
pub struct Database {
    pub client: Client,
    pub db: MongoDatabase,
}

impl Database {
    fn users<T>(&self) -> Collection<T> {
        self.db.collection("users")
    }
    fn sessions<T>(&self) -> Collection<T> {
        self.db.collection("sessions")
    }
    fn chats<T>(&self) -> Collection<T> {
        self.db.collection("chats")
    }
    fn messages<T>(&self) -> Collection<T> {
        self.db.collection("messages")
    }
    pub async fn connect(config: &ApiConfig) -> Result<Database, mongodb::error::Error> {
        let client_options = ClientOptions::parse(&config.database_url).await?;

        let client = Client::with_options(client_options)?;
        let db = client.database(&config.db_name);

        client
            .database("admin")
            .run_command(doc! { "ping": 1 }, None)
            .await?;

        tracing::info!("connected to mongodb");
        Ok(Database { client, db })
    }
}
