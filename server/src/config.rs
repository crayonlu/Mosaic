use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub port: u16,
    pub storage_type: StorageType,
    pub local_storage_path: String,
    pub r2_endpoint: Option<String>,
    pub r2_bucket: Option<String>,
    pub r2_access_key_id: Option<String>,
    pub r2_secret_access_key: Option<String>,
    pub admin_username: String,
    pub admin_password: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StorageType {
    Local,
    R2,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();

        let storage_type = env::var("STORAGE_TYPE")
            .unwrap_or_else(|_| "local".to_string())
            .to_lowercase();

        let storage_type = match storage_type.as_str() {
            "r2" => StorageType::R2,
            _ => StorageType::Local,
        };

        let r2_endpoint = env::var("R2_ENDPOINT").ok();
        let r2_bucket = env::var("R2_BUCKET").ok();
        let r2_access_key_id = env::var("R2_ACCESS_KEY_ID").ok();
        let r2_secret_access_key = env::var("R2_SECRET_ACCESS_KEY").ok();

        Ok(Config {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            storage_type,
            local_storage_path: env::var("LOCAL_STORAGE_PATH")
                .unwrap_or_else(|_| "./storage".to_string()),
            r2_endpoint,
            r2_bucket,
            r2_access_key_id,
            r2_secret_access_key,
            admin_username: env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string()),
            admin_password: env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "admin123".to_string()),
        })
    }
}
