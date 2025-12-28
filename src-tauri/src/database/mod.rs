use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    Pool, Sqlite,
};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::{error, info};

pub mod schema;

pub type DBPool = Pool<Sqlite>;

fn get_data_directory_for_db(
    app_handle: &AppHandle,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let install_dir = get_install_directory_for_db(app_handle)?;
    let data_dir = install_dir.join("data");

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| {
            Box::new(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!("Failed to create data directory: {}", e),
            )) as Box<dyn std::error::Error>
        })?;
    }

    Ok(data_dir)
}

fn get_install_directory_for_db(
    app_handle: &AppHandle,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        if resource_dir.exists() {
            return Ok(resource_dir);
        }
    }

    if let Ok(local_data_dir) = app_handle.path().app_local_data_dir() {
        if local_data_dir.exists() {
            return Ok(local_data_dir);
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        return Ok(current_dir);
    }

    Err(Box::new(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "Could not determine install directory",
    )))
}

pub async fn init_db(app_handle: &AppHandle) -> Result<DBPool, Box<dyn std::error::Error>> {
    info!("Starting database initialization...");

    let data_dir = get_data_directory_for_db(app_handle)?;
    let db_path = data_dir.join("mosaic.db");

    info!("Database path: {:?}", db_path);

    let db_exists = db_path.exists();
    if !db_exists {
        info!("Database does not exist, creating new database...");
        if let Some(parent) = db_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| {
                    let err_msg = format!("Failed to create database directory: {}", e);
                    error!("{}", err_msg);
                    Box::new(std::io::Error::new(std::io::ErrorKind::Other, err_msg))
                        as Box<dyn std::error::Error>
                })?;
            }
        }
    } else {
        info!("Database file already exists");
    }

    info!("Configuring database connection options...");
    let connect_options = SqliteConnectOptions::new()
        .filename(&db_path)
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
            let err_msg = format!("Failed to connect to database at {:?}: {}", db_path, e);
            error!("{}", err_msg);
            Box::new(std::io::Error::new(
                std::io::ErrorKind::ConnectionRefused,
                err_msg,
            )) as Box<dyn std::error::Error>
        })?;

    info!("Database connection pool created successfully");

    info!("Running database migrations...");
    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => info!("All migrations applied successfully"),
        Err(e) => {
            let err_msg = format!("Failed to apply database migrations: {}", e);
            error!("{}", err_msg);
            error!("Migration error details: {:?}", e);
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                err_msg,
            )));
        }
    }

    info!("Database initialized successfully");
    Ok(pool)
}
