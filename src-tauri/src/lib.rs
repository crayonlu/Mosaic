mod database;
mod error;
mod modules;

use modules::asset::commands::{read_audio_file, save_temp_audio, save_temp_file, upload_files};
use modules::diary::commands::{
    create_or_update_diary, get_diary_by_date, list_diaries, update_diary_mood,
    update_diary_summary,
};
use modules::memo::commands::{
    archive_memo, create_memo, delete_memo, get_memo, get_memos_by_date, list_memos,
    unarchive_memo, update_memo,
};
use modules::settings::commands::{
    delete_setting, enable_autostart, get_setting, get_settings, is_autostart_enabled,
    register_close_shortcut, register_show_shortcut, set_setting, test_ai_connection,
    unregister_shortcut,
};
use modules::settings::export::export_data;
use modules::user::commands::{get_or_create_default_user, get_user, update_user, upload_avatar};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            #[cfg(target_os = "macos")]
            tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ),
            #[cfg(not(target_os = "macos"))]
            tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            upload_files,
            save_temp_audio,
            save_temp_file,
            read_audio_file,
            create_memo,
            get_memo,
            list_memos,
            get_memos_by_date,
            update_memo,
            delete_memo,
            archive_memo,
            unarchive_memo,
            create_or_update_diary,
            get_diary_by_date,
            list_diaries,
            update_diary_mood,
            update_diary_summary,
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
            export_data,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                match database::init_db(&app_handle).await {
                    Ok(pool) => {
                        app_handle.manage(pool);
                        tracing::info!("Database pool stored in app state");
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize database: {}", e);
                        panic!("Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
