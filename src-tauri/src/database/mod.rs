use sqlx::{
    migrate::MigrateDatabase,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    Pool, Sqlite,
};
use std::fs;
use std::str::FromStr;
use tauri::{AppHandle, Manager};
use tracing::{error, info};

pub mod schema;

pub type DBPool = Pool<Sqlite>;

pub async fn init_db(app_handle: &AppHandle) -> Result<DBPool, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    let db_path = app_dir.join("mosaic.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    info!("Connecting to database at: {}", db_url);

    if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
        info!("Database does not exist, creating...");
        match Sqlite::create_database(&db_url).await {
            Ok(_) => info!("Database created successfully"),
            Err(e) => {
                error!("Failed to create database: {}", e);
                return Err(e.into());
            }
        }
    }

    let connect_options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .connect_with(connect_options)
        .await?;

    info!("Database connected successfully");

    info!("Running migrations...");

    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => info!("Migrations applied successfully"),
        Err(e) => {
            error!("Failed to apply migrations: {}", e);
            return Err(e.into());
        }
    }

    info!("Database initialized successfully");
    Ok(pool)
}
