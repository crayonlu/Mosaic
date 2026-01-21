use config;
mod api;
mod cache;
mod sync;
mod error;
mod modules;

use config::*;
use api::*;
use cache::*;
use sync::*;
use modules::memo::commands::AppState;
use modules::diary::commands::AppState as DiaryAppState;
use sync::types::SyncStatus;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;
use tauri::Manager;
use tracing_appender::rolling::daily;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use modules::ai::commands::{complete_text, rewrite_text, suggest_tags, summarize_text};
use modules::settings::commands::{delete_setting, enable_autostart, get_setting, get_settings, is_autostart_enabled, register_close_shortcut, register_show_shortcut, set_setting, test_ai_connection, unregister_shortcut};
use modules::user::commands::{get_user, get_or_create_default_user, update_user, upload_avatar};
use modules::stats::commands::{get_heatmap, get_summary, get_timeline, get_trends};
use api::{AuthApi, LoginRequest};

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

async fn init_logging(app_handle: &AppHandle) {
    let logs_dir = dirs::config_local_dir()
        .map(|dir| Some(dir.join("mosaic").join("logs")));

    if let Some(logs_path) = logs_dir {
        if !logs_path.exists() {
            let _ = std::fs::create_dir_all(&logs_path);
        }
    }

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
pub fn run() -> ! {
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
            get_server_config,
            set_server_config,
            test_server_connection,
            login,
            logout,
            get_sync_settings,
            set_sync_settings,
            create_memo,
            get_memo,
            list_memos,
            get_memos_by_date,
            update_memo,
            delete_memo,
            archive_memo,
            unarchive_memo,
            search_memos,
            get_diary_by_date,
            list_diaries,
            create_or_update_diary,
            update_diary_summary,
            update_diary_mood,
            get_heatmap,
            get_timeline,
            get_trends,
            get_summary,
            get_user,
            get_or_create_default_user,
            update_user,
            upload_avatar,
            upload_files,
            save_temp_file,
            read_image_file,
            delete_asset_file,
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
            complete_text,
            rewrite_text,
            summarize_text,
            suggest_tags,
            trigger_sync,
            get_sync_status,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async move {
                init_logging(&app_handle).await;

                let config = match AppConfig::load() {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Failed to load config: {}", e);
                        AppConfig::default()
                    }
                };

                if !config.server.is_configured() {
                    eprintln!("No server configuration found");
                    let config = config;
                    let _: Result<(), Box<dyn std::error::Error>> = (|| {
                        app.manage(config);
                        Ok(())
                    })();
                    return Err("Server not configured".into());
                }

                let client = ApiClient::new(config.server.url.clone())
                    .with_token(config.server.api_token.clone().unwrap_or_default());

                let cache_dir = dirs::config_local_dir()
                    .map(|dir| dir.join("mosaic").join("cache"));

                let cache = match cache_dir {
                    Some(path) => match CacheStore::new(path).await {
                        Ok(c) => c,
                        Err(e) => {
                            eprintln!("Failed to create cache: {}", e);
                            return Err(Box::new(e) as Box<dyn std::error::Error>);
                        }
                    },
                    None => {
                        eprintln!("Failed to get cache dir");
                        return Err("Failed to get cache dir".into() as Box<dyn std::error::Error>);
                    }
                };

                let sync_manager = SyncManager::new(config.clone(), client.clone(), cache.clone());

                let memo_api = Arc::new(MemoApi::new(client.clone()));
                let diary_api = Arc::new(DiaryApi::new(client.clone()));
                let resource_api = Arc::new(ResourceApi::new(client.clone()));
                let user_api = Arc::new(UserApi::new(client.clone()));
                let stats_api = Arc::new(StatsApi::new(client.clone()));

                let user_api = Arc::new(UserApi::new(client.clone()));

                let memo_app_state = AppState {
                    config: Arc::new(config.clone()),
                    memo_api: memo_api.clone(),
                    cache: Arc::new(cache.clone()),
                    sync_manager: Arc::new(sync_manager.clone()),
                    online: Arc::new(AtomicBool::new(true)),
                };

                let diary_app_state = DiaryAppState {
                    config: Arc::new(config.clone()),
                    diary_api: diary_api.clone(),
                    sync_manager: Arc::new(sync_manager.clone()),
                    online: Arc::new(AtomicBool::new(true)),
                };

                let stats_app_state = StatsAppState {
                    config: Arc::new(config.clone()),
                    stats_api: stats_api.clone(),
                    cache: Arc::new(cache.clone()),
                    sync_manager: Arc::new(sync_manager.clone()),
                    online: Arc::new(AtomicBool::new(true)),
                };

                let user_app_state = crate::modules::user::commands::UserAppState {
                    config: Arc::new(config.clone()),
                    user_api: user_api.clone(),
                    online: Arc::new(AtomicBool::new(true)),
                };

                app.manage(memo_app_state);
                app.manage(diary_app_state);
                app.manage(stats_app_state);
                app.manage(user_app_state);
                app.manage(config);
                app.manage(cache);
                app.manage(client);

                if config.auto_sync {
                    sync_manager.start_auto_sync().await;
                }

                Ok::<(), Box<dyn std::error::Error>>(())
            })
        })

            let show_menu_item =
                MenuItem::with_id(&app_handle, "show", "显示窗口", true, None::<&str>)?;
            let quit_menu_item =
                MenuItem::with_id(&app_handle, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(&app_handle, &[&show_menu_item, &quit_menu_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app_handle.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok::<(), Box<dyn std::error::Error>>(())
        })?;
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
pub async fn trigger_sync(state: tauri::State<'_, AppState>) -> Result<SyncStatusInfo, String> {
    state.sync_manager.sync_all().await
        .map_err(|e| e.to_string())?;

    Ok(SyncStatusInfo {
        status: "completed".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        error: None,
    })
}

#[tauri::command]
pub async fn get_sync_status(state: tauri::State<'_, AppState>) -> Result<SyncStatus, String> {
    let online = state.sync_manager.is_online();
    let is_syncing = state.sync_manager.is_syncing().await;

    Ok(if !online {
        SyncStatus::Offline
    } else if is_syncing {
        SyncStatus::Syncing
    } else {
        SyncStatus::Idle
    })
}
