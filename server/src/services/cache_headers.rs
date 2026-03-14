use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub struct CacheHeaders;

impl CacheHeaders {
    pub fn generate_etag(data: &[u8]) -> String {
        let mut hasher = DefaultHasher::new();
        data.hash(&mut hasher);
        format!("\"{:x}\"", hasher.finish())
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
