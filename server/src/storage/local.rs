use crate::storage::traits::Storage;
use async_trait::async_trait;
use bytes::Bytes;
use std::path::Path;
use tokio::fs as tokio_fs;
use tokio::io::AsyncReadExt;

pub struct LocalStorage {
    base_path: String,
}

impl LocalStorage {
    pub async fn new(base_path: &str) -> anyhow::Result<Self> {
        tokio_fs::create_dir_all(base_path).await?;
        Ok(Self {
            base_path: base_path.to_string(),
        })
    }

    fn get_full_path(&self, path: &str) -> String {
        format!("{}/{}", self.base_path.trim_end_matches('/'), path)
    }
}

#[async_trait]
impl Storage for LocalStorage {
    async fn upload(&self, path: &str, data: Bytes, _mime_type: &str) -> anyhow::Result<String> {
        let full_path = self.get_full_path(path);
        let parent = Path::new(&full_path)
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Invalid path"))?;
        tokio_fs::create_dir_all(parent).await?;
        tokio_fs::write(&full_path, data).await?;
        Ok(path.to_string())
    }

    async fn download(&self, path: &str) -> anyhow::Result<Bytes> {
        let full_path = self.get_full_path(path);
        let mut file = tokio_fs::File::open(&full_path).await?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).await?;
        Ok(Bytes::from(buffer))
    }

    async fn delete(&self, path: &str) -> anyhow::Result<()> {
        let full_path = self.get_full_path(path);
        tokio_fs::remove_file(&full_path).await?;
        Ok(())
    }

    async fn get_presigned_url(&self, path: &str, _expires_secs: u64) -> anyhow::Result<String> {
        Ok(format!("/api/resources/download/{}", path))
    }
}
