use crate::config::Config;
use crate::error::AppError;
use tokio::process::Command;

const THUMBNAIL_WIDTH: i32 = 640;
const OPTIMIZED_WIDTH: i32 = 1280;
const CRF: &str = "23";
const AUDIO_BITRATE: &str = "128k";

pub struct VideoProcessor {
    ffmpeg_binary: String,
}

impl VideoProcessor {
    pub fn new(config: &Config) -> Self {
        Self {
            ffmpeg_binary: config.ffmpeg_binary.clone(),
        }
    }

    pub async fn create_thumbnail(&self, input: &[u8]) -> Result<Vec<u8>, AppError> {
        let temp_dir = std::env::temp_dir();
        let id = uuid::Uuid::new_v4();
        let input_path = temp_dir.join(format!("mosaic_{}_input.mp4", id));
        let output_path = temp_dir.join(format!("mosaic_{}_thumb.jpg", id));

        tokio::fs::write(&input_path, input)
            .await
            .map_err(|e| AppError::Processing(e.to_string()))?;

        let output = Command::new(&self.ffmpeg_binary)
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                input_path.to_str().unwrap(),
                "-frames:v",
                "1",
                "-vf",
                &format!("scale={}:-2", THUMBNAIL_WIDTH),
                "-q:v",
                "5",
                output_path.to_str().unwrap(),
            ])
            .output()
            .await
            .map_err(|e| AppError::Processing(e.to_string()))?;

        let result = if output.status.success() {
            tokio::fs::read(&output_path)
                .await
                .map_err(|e| AppError::Processing(e.to_string()))
        } else {
            Err(AppError::Processing(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ))
        };

        let _ = tokio::fs::remove_file(&input_path).await;
        let _ = tokio::fs::remove_file(&output_path).await;

        result
    }

    pub async fn create_optimized(&self, input: &[u8]) -> Result<Vec<u8>, AppError> {
        let temp_dir = std::env::temp_dir();
        let id = uuid::Uuid::new_v4();
        let input_path = temp_dir.join(format!("mosaic_{}_input.mp4", id));
        let output_path = temp_dir.join(format!("mosaic_{}_opt.mp4", id));

        tokio::fs::write(&input_path, input)
            .await
            .map_err(|e| AppError::Processing(e.to_string()))?;

        let output = Command::new(&self.ffmpeg_binary)
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                input_path.to_str().unwrap(),
                "-vf",
                &format!("scale={}:-2", OPTIMIZED_WIDTH),
                "-c:v",
                "libx265",
                "-crf",
                CRF,
                "-c:a",
                "aac",
                "-b:a",
                AUDIO_BITRATE,
                "-movflags",
                "+faststart",
                output_path.to_str().unwrap(),
            ])
            .output()
            .await
            .map_err(|e| AppError::Processing(e.to_string()))?;

        let result = if output.status.success() {
            tokio::fs::read(&output_path)
                .await
                .map_err(|e| AppError::Processing(e.to_string()))
        } else {
            Err(AppError::Processing(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ))
        };

        let _ = tokio::fs::remove_file(&input_path).await;
        let _ = tokio::fs::remove_file(&output_path).await;

        result
    }
}
