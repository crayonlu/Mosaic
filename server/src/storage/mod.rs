use crate::config::{Config, StorageType};
use crate::storage::local::LocalStorage;
use crate::storage::r2::R2Storage;
use crate::storage::traits::Storage;
use std::sync::Arc;

pub mod local;
pub mod r2;
pub mod traits;

pub async fn create_storage(config: &Config) -> anyhow::Result<Arc<dyn Storage>> {
    match config.storage_type {
        StorageType::Local => {
            let storage = LocalStorage::new(&config.local_storage_path).await?;
            Ok(Arc::new(storage))
        }
        StorageType::R2 => {
            let storage = R2Storage::new(
                config
                    .r2_endpoint
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("R2_ENDPOINT not set"))?,
                config
                    .r2_bucket
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("R2_BUCKET not set"))?,
                config
                    .r2_access_key_id
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("R2_ACCESS_KEY_ID not set"))?,
                config
                    .r2_secret_access_key
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("R2_SECRET_ACCESS_KEY not set"))?,
            )
            .await?;
            Ok(Arc::new(storage))
        }
    }
}
