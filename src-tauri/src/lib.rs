mod database;
mod error;
mod modules;

use std::path::PathBuf;
use tauri::AppHandle;
use tracing_appender::rolling::daily;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use modules::asset::commands::{
    read_audio_file, read_image_file, save_temp_audio, save_temp_file, upload_files,
};
use modules::diary::commands::{
    create_or_update_diary, get_diary_by_date, list_diaries, update_diary_mood,
    update_diary_summary,
};
use modules::memo::commands::{
    archive_memo, create_memo, delete_memo, get_memo, get_memos_by_date, list_memos, search_memos,
    unarchive_memo, update_memo,
};
use modules::settings::commands::{
    delete_setting, enable_autostart, get_setting, get_settings, is_autostart_enabled,
    register_close_shortcut, register_show_shortcut, set_setting, test_ai_connection,
    unregister_shortcut,
};
use modules::stats::commands::{get_heatmap, get_summary, get_timeline, get_trends};
use modules::storage::commands::{
    get_data_directory, get_default_data_directory, needs_data_migration, select_data_directory,
    set_data_directory,
};
use modules::user::commands::{get_or_create_default_user, get_user, update_user, upload_avatar};
use tauri::Manager;

async fn init_logging(app_handle: &AppHandle) {
    let logs_dir = match modules::storage::path::get_logs_directory(app_handle).await {
        Ok(dir) => Some(dir),
        Err(e) => {
            eprintln!("Failed to get logs directory: {}", e);
            None
        }
    };

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            #[cfg(target_os = "macos")]
            tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None),
            #[cfg(not(target_os = "macos"))]
            tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            upload_files,
            save_temp_audio,
            save_temp_file,
            read_audio_file,
            read_image_file,
            create_memo,
            get_memo,
            list_memos,
            get_memos_by_date,
            update_memo,
            delete_memo,
            archive_memo,
            unarchive_memo,
            search_memos,
            create_or_update_diary,
            get_diary_by_date,
            list_diaries,
            update_diary_mood,
            update_diary_summary,
            get_heatmap,
            get_timeline,
            get_trends,
            get_summary,
            get_user,
            get_or_create_default_user,
            update_user,
            upload_avatar,
            get_setting,
            get_settings,
            set_setting,
            delete_setting,
            test_ai_connection,
            enable_autostart,
            is_autostart_enabled,
            register_show_shortcut,
            register_close_shortcut,
            unregister_shortcut,
            get_data_directory,
            get_default_data_directory,
            select_data_directory,
            set_data_directory,
            needs_data_migration,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                init_logging(&app_handle).await;

                match database::init_db(&app_handle).await {
                    Ok(pool) => {
                        app_handle.manage(pool);
                        tracing::info!("Database pool stored in app state");
                        Ok(())
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to initialize database: {}", e);
                        tracing::error!("{}", error_msg);
                        if let Ok(logs_dir) =
                            crate::modules::storage::path::get_logs_directory(&app_handle).await
                        {
                            tracing::error!(
                                "Database initialization failed. Please check the logs at: {:?}",
                                logs_dir
                            );
                        }
                        Err(error_msg.into())
                    }
                }
            })
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
