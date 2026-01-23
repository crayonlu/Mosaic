use crate::storage::traits::Storage;
use async_trait::async_trait;
use bytes::Bytes;
use opendal::services;
use opendal::Operator;
use std::time::Duration;

pub struct R2Storage {
    operator: Operator,
}

impl R2Storage {
    pub async fn new(
        endpoint: &str,
        bucket: &str,
        access_key_id: &str,
        secret_access_key: &str,
    ) -> anyhow::Result<Self> {
        let op = Operator::new(
            services::S3::default()
                .endpoint(endpoint)
                .bucket(bucket)
                .access_key_id(access_key_id)
                .secret_access_key(secret_access_key),
        )?
        .finish();

        Ok(Self { operator: op })
    }
}

#[async_trait]
impl Storage for R2Storage {
    async fn upload(&self, path: &str, data: Bytes, _mime_type: &str) -> anyhow::Result<String> {
        self.operator.write(path, data).await?;
        Ok(path.to_string())
    }

    async fn download(&self, path: &str) -> anyhow::Result<Bytes> {
        let data = self.operator.read(path).await?;
        Ok(data.to_bytes())
    }

    async fn delete(&self, path: &str) -> anyhow::Result<()> {
        self.operator.delete(path).await?;
        Ok(())
    }

    async fn get_presigned_url(&self, path: &str, expires_secs: u64) -> anyhow::Result<String> {
        let presigned_req = self
            .operator
            .presign_read(path, Duration::from_secs(expires_secs))
            .await?;
        Ok(presigned_req.uri().to_string())
    }
}
