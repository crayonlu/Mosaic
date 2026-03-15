use sha2::{Sha256, Digest};

pub struct CacheHeaders;

impl CacheHeaders {
    pub fn generate_etag(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        format!("\"{:x}\"", result)
    }

    pub fn for_original() -> Vec<(&'static str, String)> {
        vec![("Cache-Control", "public, max-age=31536000".to_string())]
    }

    pub fn for_optimized() -> Vec<(&'static str, String)> {
        vec![("Cache-Control", "public, max-age=2592000".to_string())]
    }

    pub fn for_thumbnail() -> Vec<(&'static str, String)> {
        vec![("Cache-Control", "public, max-age=86400".to_string())]
    }

    pub fn for_avatar() -> Vec<(&'static str, String)> {
        vec![("Cache-Control", "public, max-age=3600".to_string())]
    }
}
