use sha2::{Digest, Sha256};

pub struct CacheHeaders;

impl CacheHeaders {
    pub fn generate_etag(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        format!("\"{:x}\"", result)
    }

    pub fn for_original() -> Vec<(&'static str, String)> {
        vec![
            ("Cache-Control", "private, max-age=31536000".to_string()),
            ("Vary", "Authorization".to_string()),
        ]
    }

    pub fn for_optimized() -> Vec<(&'static str, String)> {
        vec![
            ("Cache-Control", "private, max-age=2592000".to_string()),
            ("Vary", "Authorization".to_string()),
        ]
    }

    pub fn for_thumbnail() -> Vec<(&'static str, String)> {
        vec![
            ("Cache-Control", "private, max-age=86400".to_string()),
            ("Vary", "Authorization".to_string()),
        ]
    }

    pub fn for_avatar() -> Vec<(&'static str, String)> {
        vec![
            ("Cache-Control", "private, max-age=3600".to_string()),
            ("Vary", "Authorization".to_string()),
        ]
    }
}
