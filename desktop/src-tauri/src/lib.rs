mod api;
mod config;
mod error;
mod models;
mod modules;

use api::*;
use config::commands::{
    change_password, clear_auth_tokens, get_server_config, login, logout, refresh_token,
    set_auth_tokens, set_server_config, test_server_connection,
};
use config::*;
use modules::ai::commands::{complete_text, rewrite_text, suggest_tags, summarize_text};
use modules::settings::commands::{
    delete_setting, enable_autostart, get_data_directory, get_default_data_directory, get_setting,
    get_settings, is_autostart_enabled, needs_data_migration, register_close_shortcut,
    register_show_shortcut, set_data_directory, set_setting, test_ai_connection,
    unregister_shortcut,
};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;
use tauri::Manager;
use tracing_appender::rolling::daily;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

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
            set_auth_tokens,
            clear_auth_tokens,
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

                let is_server_configured = config.server.is_configured();
                if !is_server_configured {
                    eprintln!("No server configuration found - starting in setup mode");
                }

                let client = if is_server_configured {
                    let config_clone_for_refresh = config_arc.clone();
                    let refresh_fn = move || {
                        let config = config_clone_for_refresh.clone();
                        Box::pin(async move {
                            let refresh_token = {
                                let config_guard = config.read().await;
                                config_guard.server.refresh_token.clone().ok_or_else(|| {
                                    error::AppError::Internal(
                                        "No refresh token available".to_string(),
                                    )
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
                            config_guard.server.refresh_token =
                                Some(response.refresh_token.clone());
                            config_guard
                                .save()
                                .map_err(|e| error::AppError::Internal(e.to_string()))?;

                            Ok(response.access_token)
                        })
                            as std::pin::Pin<
                                Box<
                                    dyn std::future::Future<Output = error::AppResult<String>>
                                        + Send,
                                >,
                            >
                    };

                    ApiClient::new(config.server.url.clone())
                        .with_token(config.server.api_token.clone().unwrap_or_default())
                        .with_refresh_fn(refresh_fn)
                } else {
                    ApiClient::new("http://localhost:3000".to_string())
                };

                app.manage(config_arc.clone());
                app.manage(client);

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
