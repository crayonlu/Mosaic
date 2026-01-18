use async_trait::async_trait;
use bytes::Bytes;

#[async_trait]
pub trait Storage: Send + Sync {
    async fn upload(&self, path: &str, data: Bytes, mime_type: &str) -> anyhow::Result<String>;
    async fn download(&self, path: &str) -> anyhow::Result<Bytes>;
    async fn delete(&self, path: &str) -> anyhow::Result<()>;
    async fn get_presigned_url(&self, path: &str, expires_secs: u64) -> anyhow::Result<String>;
}
