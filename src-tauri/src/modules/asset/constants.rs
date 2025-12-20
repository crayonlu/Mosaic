pub const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];
pub const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "m4a", "aac"];
pub const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov"];

pub fn is_image_format(ext: &str) -> bool {
    IMAGE_EXTENSIONS.contains(&ext)
}

pub fn is_audio_format(ext: &str) -> bool {
    AUDIO_EXTENSIONS.contains(&ext)
}

pub fn is_video_format(ext: &str) -> bool {
    VIDEO_EXTENSIONS.contains(&ext)
}

pub fn infer_resource_type_and_mime(ext: &str) -> (String, String) {
    if is_image_format(ext) {
        ("image".to_string(), format!("image/{}", ext))
    } else if is_audio_format(ext) {
        ("voice".to_string(), format!("audio/{}", ext))
    } else if is_video_format(ext) {
        ("video".to_string(), format!("video/{}", ext))
    } else {
        ("file".to_string(), "application/octet-stream".to_string())
    }
}

