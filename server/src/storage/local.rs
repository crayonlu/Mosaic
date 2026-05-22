use crate::storage::traits::Storage;
use async_trait::async_trait;
use bytes::Bytes;
use std::path::PathBuf;
use tokio::fs as tokio_fs;
use tokio::io::AsyncReadExt;

pub struct LocalStorage {
    base_path: PathBuf,
}

impl LocalStorage {
    pub async fn new(base_path: &str) -> anyhow::Result<Self> {
        tokio_fs::create_dir_all(base_path).await?;
        let canonical_base = std::fs::canonicalize(base_path)
            .unwrap_or_else(|_| PathBuf::from(base_path));
        Ok(Self {
            base_path: canonical_base,
        })
    }

    fn get_full_path(&self, path: &str) -> anyhow::Result<PathBuf> {
        let full_path = self.base_path.join(path);
        // Resolve the path and ensure it stays within base_path to prevent directory traversal
        let canonical = full_path.canonicalize().unwrap_or_else(|_| {
            // For new files that don't exist yet, normalize manually
            let mut normalized = PathBuf::new();
            for component in full_path.components() {
                match component {
                    std::path::Component::ParentDir => { normalized.pop(); }
                    std::path::Component::Normal(c) => { normalized.push(c); }
                    std::path::Component::RootDir => { normalized.push("/"); }
                    std::path::Component::Prefix(p) => { normalized.push(p.as_os_str()); }
                    std::path::Component::CurDir => {}
                }
            }
            normalized
        });

        if !canonical.starts_with(&self.base_path) {
            return Err(anyhow::anyhow!("Path traversal detected"));
        }
        Ok(canonical)
    }
}

#[async_trait]
impl Storage for LocalStorage {
    async fn upload(&self, path: &str, data: Bytes, _mime_type: &str) -> anyhow::Result<String> {
        let full_path = self.get_full_path(path)?;
        let parent = full_path
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Invalid path"))?;
        tokio_fs::create_dir_all(parent).await?;
        tokio_fs::write(&full_path, data).await?;
        Ok(path.to_string())
    }

    async fn download(&self, path: &str) -> anyhow::Result<Bytes> {
        let full_path = self.get_full_path(path)?;
        let mut file = tokio_fs::File::open(&full_path).await?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).await?;
        Ok(Bytes::from(buffer))
    }

    async fn delete(&self, path: &str) -> anyhow::Result<()> {
        let full_path = self.get_full_path(path)?;
        tokio_fs::remove_file(&full_path).await?;
        Ok(())
    }

    async fn exists(&self, path: &str) -> bool {
        match self.get_full_path(path) {
            Ok(full_path) => tokio_fs::try_exists(&full_path).await.unwrap_or(false),
            Err(_) => false,
        }
    }

    async fn get_presigned_url(&self, path: &str, _expires_secs: u64) -> anyhow::Result<String> {
        Ok(format!("/api/resources/download/{}", path))
    }

    async fn get_presigned_upload_url(
        &self,
        _path: &str,
        _expires_secs: u64,
    ) -> anyhow::Result<String> {
        Err(anyhow::anyhow!(
            "Direct upload not supported for local storage"
        ))
    }
}
