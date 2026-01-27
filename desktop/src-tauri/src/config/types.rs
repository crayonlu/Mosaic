use dirs::config_local_dir;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub api_token: Option<String>,
    pub refresh_token: Option<String>,
    // AI Configuration
    pub ai_provider: String,
    pub ai_base_url: String,
    pub ai_api_key: String,
    pub ai_model: Option<String>,
    pub ai_temperature: Option<f64>,
    pub ai_max_tokens: Option<i32>,
    pub ai_timeout: Option<u64>,
}

impl ServerConfig {
    pub fn is_configured(&self) -> bool {
        !self.url.is_empty() && !self.username.is_empty() && !self.password.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub server: ServerConfig,
    pub auto_sync: bool,
    pub sync_interval_seconds: u64,
    pub offline_mode: bool,
    pub custom_data_directory: Option<String>,
}

impl AppConfig {
    pub fn config_dir() -> PathBuf {
        if let Ok(config) = Self::load() {
            if let Some(custom_dir) = config.custom_data_directory {
                return PathBuf::from(custom_dir);
            }
        }
        config_local_dir()
            .map(|dir| dir.join("mosaic"))
            .unwrap_or_else(|| PathBuf::from(".mosaic"))
    }

    pub fn default_config_dir() -> PathBuf {
        config_local_dir()
            .map(|dir| dir.join("mosaic"))
            .unwrap_or_else(|| PathBuf::from(".mosaic"))
    }

    pub fn config_file() -> PathBuf {
        Self::default_config_dir().join("config.json")
    }

    pub fn load() -> Result<Self, std::io::Error> {
        let config_path = Self::config_file();
        if !config_path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&config_path)?;
        Ok(serde_json::from_str(&content)?)
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let config_dir = Self::config_dir();
        std::fs::create_dir_all(&config_dir)?;
        let config_path = Self::config_file();
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&config_path, content)
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            username: String::new(),
            password: String::new(),
            api_token: None,
            refresh_token: None,
            ai_provider: String::new(),
            ai_base_url: String::new(),
            ai_api_key: String::new(),
            ai_model: None,
            ai_temperature: Some(0.7),
            ai_max_tokens: Some(1000),
            ai_timeout: Some(30),
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            auto_sync: true,
            sync_interval_seconds: 300,
            offline_mode: false,
            custom_data_directory: None,
        }
    }
}
