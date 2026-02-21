mod api;
mod cache;
mod config;
mod error;
mod models;
mod modules;
mod sync;

use api::*;
use cache::*;
use config::commands::{
    change_password, get_server_config, get_sync_settings, login, logout, refresh_token,
    set_server_config, set_sync_settings, test_server_connection,
};
use config::*;
use modules::ai::commands::{complete_text, rewrite_text, suggest_tags, summarize_text};
use modules::asset::commands::*;
use modules::diary::commands::*;
use modules::memo::commands::*;
use modules::settings::commands::{
    delete_setting, enable_autostart, get_data_directory, get_default_data_directory, get_setting,
    get_settings, is_autostart_enabled, needs_data_migration, register_close_shortcut,
    register_show_shortcut, set_data_directory, set_setting, test_ai_connection,
    unregister_shortcut,
};
use modules::stats::commands::{
    clear_backend_cache, clear_diaries_cache, clear_memos_cache, get_cache_stats, get_heatmap,
    get_summary, get_timeline, get_trends,
};
use modules::user::commands::{get_or_create_default_user, get_user, update_user, upload_avatar};
use sync::commands::{check_connection, get_sync_status, trigger_sync};
use sync::*;

use crate::modules::stats::commands::StatsAppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;
use tauri::Manager;
use tracing_appender::rolling::daily;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

async fn init_logging(_app_handle: &AppHandle) {
    let logs_dir = dirs::config_local_dir().map(|dir| dir.join("mosaic").join("logs"));

    if let Some(ref logs_path) = logs_dir {
        if !logs_path.exists() {
            let _ = std::fs::create_dir_all(logs_path);
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
            get_server_config,
            set_server_config,
            test_server_connection,
            login,
            logout,
            refresh_token,
            change_password,
            get_sync_settings,
            set_sync_settings,
            create_memo,
            get_memo,
            list_memos,
            get_memos_by_date,
            get_memos_by_diary_date,
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
            get_resource,
            get_presigned_image_url,
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
            set_data_directory,
            needs_data_migration,
            complete_text,
            rewrite_text,
            summarize_text,
            suggest_tags,
            trigger_sync,
            get_sync_status,
            check_connection,
            get_cache_stats,
            clear_backend_cache,
            clear_memos_cache,
            clear_diaries_cache,
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

                let config_arc = std::sync::Arc::new(tokio::sync::RwLock::new(config.clone()));

                if !config.server.is_configured() {
                    eprintln!("No server configuration found - starting in setup mode");

                    let cache_dir =
                        dirs::config_local_dir().map(|dir| dir.join("mosaic").join("cache"));

                    let cache = match cache_dir {
                        Some(path) => match CacheStore::new(path).await {
                            Ok(c) => Some(c),
                            Err(e) => {
                                eprintln!("Failed to create cache in setup mode: {}", e);
                                let temp_path = std::env::temp_dir().join("mosaic_cache");
                                CacheStore::new(temp_path).await.ok()
                            }
                        },
                        None => {
                            eprintln!("Failed to get cache dir in setup mode");
                            None
                        }
                    };

                    if let Some(cache) = cache {
                        let client = ApiClient::new("http://localhost:3000".to_string());

                        let memo_api = Arc::new(MemoApi::new(client.clone()));
                        let diary_api = Arc::new(DiaryApi::new(client.clone()));
                        let stats_api = Arc::new(StatsApi::new(client.clone()));
                        let user_api = Arc::new(UserApi::new(client.clone()));

                        let memo_app_state = AppState {
                            memo_api: memo_api.clone(),
                            cache: Arc::new(cache.clone()),
                            online: Arc::new(AtomicBool::new(false)), // Offline in setup mode
                        };

                        let diary_app_state = DiaryAppState {
                            diary_api: diary_api.clone(),
                            cache: Arc::new(cache.clone()),
                            online: Arc::new(AtomicBool::new(false)),
                        };

                        let stats_app_state = StatsAppState {
                            stats_api: stats_api.clone(),
                            cache: Arc::new(cache.clone()),
                            online: Arc::new(AtomicBool::new(false)),
                        };

                        let user_app_state = crate::modules::user::commands::UserAppState {
                            config: config_arc.clone(),
                            user_api: user_api.clone(),
                            online: Arc::new(AtomicBool::new(false)),
                        };

                        app.manage(memo_app_state);
                        app.manage(diary_app_state);
                        app.manage(stats_app_state);
                        app.manage(user_app_state);
                        app.manage(cache);
                        app.manage(client);
                    }

                    app.manage(config_arc);

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

                    return Ok::<(), Box<dyn std::error::Error>>(());
                }

                let config_clone_for_refresh = config_arc.clone();
                let refresh_fn = move || {
                    let config = config_clone_for_refresh.clone();
                    Box::pin(async move {
                        let refresh_token = {
                            let config_guard = config.read().await;
                            config_guard.server.refresh_token.clone().ok_or_else(|| {
                                error::AppError::Internal("No refresh token available".to_string())
                            })?
                        };

                        let server_url = {
                            let config_guard = config.read().await;
                            config_guard.server.url.clone()
                        };

                        let auth_api = AuthApi::new(server_url);
                        let response = auth_api.refresh_token(&refresh_token).await?;

                        let mut config_guard = config.write().await;
                        config_guard.server.api_token = Some(response.access_token.clone());
                        config_guard.server.refresh_token = Some(response.refresh_token.clone());
                        config_guard
                            .save()
                            .map_err(|e| error::AppError::Internal(e.to_string()))?;

                        Ok(response.access_token)
                    })
                        as std::pin::Pin<
                            Box<dyn std::future::Future<Output = error::AppResult<String>> + Send>,
                        >
                };

                let client = ApiClient::new(config.server.url.clone())
                    .with_token(config.server.api_token.clone().unwrap_or_default())
                    .with_refresh_fn(refresh_fn);

                let cache_dir =
                    dirs::config_local_dir().map(|dir| dir.join("mosaic").join("cache"));

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
                        return Err(Box::<dyn std::error::Error>::from(
                            "Failed to get cache dir",
                        ));
                    }
                };

                let sync_manager = SyncManager::new(config.clone(), client.clone(), cache.clone());

                let memo_api = Arc::new(MemoApi::new(client.clone()));
                let diary_api = Arc::new(DiaryApi::new(client.clone()));
                let stats_api = Arc::new(StatsApi::new(client.clone()));

                let user_api = Arc::new(UserApi::new(client.clone()));

                let memo_app_state = AppState {
                    memo_api: memo_api.clone(),
                    cache: Arc::new(cache.clone()),
                    online: Arc::new(AtomicBool::new(true)),
                };

                let diary_app_state = DiaryAppState {
                    diary_api: diary_api.clone(),
                    cache: Arc::new(cache.clone()),
                    online: Arc::new(AtomicBool::new(true)),
                };

                let stats_app_state = StatsAppState {
                    stats_api: stats_api.clone(),
                    cache: Arc::new(cache.clone()),
                    online: Arc::new(AtomicBool::new(true)),
                };

                let user_app_state = crate::modules::user::commands::UserAppState {
                    config: config_arc.clone(),
                    user_api: user_api.clone(),
                    online: Arc::new(AtomicBool::new(true)),
                };

                app.manage(memo_app_state);
                app.manage(diary_app_state);
                app.manage(stats_app_state);
                app.manage(user_app_state);
                app.manage(config_arc.clone());
                app.manage(cache);
                app.manage(client);
                app.manage(Arc::new(sync_manager.clone()));

                if config.auto_sync {
                    sync_manager.start_auto_sync().await;
                }

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
            })
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
