mod database;
mod error;
mod modules;

use modules::asset::commands::upload_files;
use modules::diary::commands::{
    create_or_update_diary, get_diary_by_date, list_diaries, update_diary_mood,
    update_diary_summary,
};
use modules::memo::commands::{
    archive_memo, create_memo, delete_memo, get_memo, get_memos_by_date, list_memos,
    unarchive_memo, update_memo,
};
use modules::user::commands::{
    get_or_create_default_user, get_user, update_user, upload_avatar,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            upload_files,
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
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match database::init_db(&app_handle).await {
                    Ok(pool) => {
                        app_handle.manage(pool);
                        tracing::info!("Database pool stored in app state");
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
