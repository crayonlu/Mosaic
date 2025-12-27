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
    info!("Starting database initialization...");
    
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| {
            let err_msg = format!("Failed to get app data directory: {}", e);
            error!("{}", err_msg);
            Box::new(std::io::Error::new(std::io::ErrorKind::NotFound, err_msg)) as Box<dyn std::error::Error>
        })?;
    
    info!("App data directory: {:?}", app_dir);
    
    if !app_dir.exists() {
        info!("App data directory does not exist, creating...");
        fs::create_dir_all(&app_dir).map_err(|e| {
            let err_msg = format!("Failed to create app data directory at {:?}: {}", app_dir, e);
            error!("{}", err_msg);
            Box::new(std::io::Error::new(std::io::ErrorKind::PermissionDenied, err_msg)) as Box<dyn std::error::Error>
        })?;
        info!("App data directory created successfully");
    } else {
        info!("App data directory already exists");
    }

    let db_path = app_dir.join("mosaic.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    info!("Database path: {:?}", db_path);
    info!("Connecting to database at: {}", db_url);

    let db_exists = Sqlite::database_exists(&db_url).await.unwrap_or(false);
    if !db_exists {
        info!("Database does not exist, creating new database...");
        match Sqlite::create_database(&db_url).await {
            Ok(_) => info!("Database created successfully"),
            Err(e) => {
                let err_msg = format!("Failed to create database at {}: {}", db_url, e);
                error!("{}", err_msg);
                return Err(Box::new(std::io::Error::new(std::io::ErrorKind::Other, err_msg)));
            }
        }
    } else {
        info!("Database file already exists");
    }

    info!("Configuring database connection options...");
    let connect_options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| {
            let err_msg = format!("Failed to parse database URL {}: {}", db_url, e);
            error!("{}", err_msg);
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, err_msg)) as Box<dyn std::error::Error>
        })?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);

    info!("Creating database connection pool...");
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .connect_with(connect_options)
        .await
        .map_err(|e| {
            let err_msg = format!("Failed to connect to database at {}: {}", db_url, e);
            error!("{}", err_msg);
            Box::new(std::io::Error::new(std::io::ErrorKind::ConnectionRefused, err_msg)) as Box<dyn std::error::Error>
        })?;

    info!("Database connection pool created successfully");

    info!("Running database migrations...");
    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => info!("All migrations applied successfully"),
        Err(e) => {
            let err_msg = format!("Failed to apply database migrations: {}", e);
            error!("{}", err_msg);
            error!("Migration error details: {:?}", e);
            return Err(Box::new(std::io::Error::new(std::io::ErrorKind::Other, err_msg)));
        }
    }

    info!("Database initialized successfully");
    Ok(pool)
}
