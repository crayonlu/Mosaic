#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod database;
mod error;

use std::path::PathBuf;
use tracing_appender::rolling::daily;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn init_logging() {
    let logs_dir = get_logs_directory();
    let env_filter = tracing_subscriber::EnvFilter::from_default_env();
    
    let registry = tracing_subscriber::registry();
    
    if let Some(logs_path) = logs_dir {
        let file_appender = daily(&logs_path, "mosaic.log");
        let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
        let file_layer = tracing_subscriber::fmt::layer()
            .with_writer(non_blocking)
            .with_ansi(false);
        
        registry
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer())
            .with(file_layer)
            .init();
        
        std::mem::forget(_guard);
    } else {
        registry
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer())
            .init();
    }
}

fn get_logs_directory() -> Option<PathBuf> {
    if let Some(app_data) = dirs::data_local_dir() {
        let logs_dir = app_data.join("xyz.cyncyn.mosaic").join("logs");
        if let Err(e) = std::fs::create_dir_all(&logs_dir) {
            eprintln!("Failed to create logs directory: {}", e);
            return None;
        }
        return Some(logs_dir);
    }
    None
}

fn main() {
    init_logging();
    mosaic_lib::run()
}
