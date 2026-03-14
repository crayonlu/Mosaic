use crate::error::AppError;
use image::{ImageFormat, ImageReader};
use std::io::Cursor;

const THUMBNAIL_WIDTH: u32 = 320;
const THUMBNAIL_QUALITY: u8 = 70;
const OPTIMIZED_QUALITY: u8 = 80;

pub struct ImageProcessor;

impl ImageProcessor {
    pub async fn create_thumbnail(input: &[u8]) -> Result<Vec<u8>, AppError> {
        let input_vec = input.to_vec();
        tokio::task::spawn_blocking(move || {
            Self::process_sync(&input_vec, THUMBNAIL_WIDTH, ImageFormat::Jpeg, THUMBNAIL_QUALITY)
        })
        .await
        .map_err(|e| AppError::Processing(e.to_string()))?
    }

    pub async fn create_optimized(input: &[u8]) -> Result<Vec<u8>, AppError> {
        let input_vec = input.to_vec();
        tokio::task::spawn_blocking(move || {
            Self::process_sync(&input_vec, 0, ImageFormat::WebP, OPTIMIZED_QUALITY)
        })
        .await
        .map_err(|e| AppError::Processing(e.to_string()))?
    }

    fn process_sync(
        input: &[u8],
        target_width: u32,
        format: ImageFormat,
        quality: u8,
    ) -> Result<Vec<u8>, AppError> {
        let img = ImageReader::new(Cursor::new(input))
            .with_guessed_format()
            .map_err(|e| AppError::Processing(e.to_string()))?
            .decode()
            .map_err(|e| AppError::Processing(e.to_string()))?;

        let processed = if target_width > 0 && img.width() > target_width {
            let ratio = target_width as f32 / img.width() as f32;
            let height = (img.height() as f32 * ratio) as u32;
            img.resize(target_width, height, image::imageops::FilterType::Lanczos3)
        } else {
            img
        };

        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);

        match format {
            ImageFormat::WebP => {
                processed
                    .write_to(&mut cursor, ImageFormat::WebP)
                    .map_err(|e| AppError::Processing(e.to_string()))?;
            }
            _ => {
                let rgb = processed.to_rgb8();
                let mut encoder =
                    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
                encoder
                    .encode_image(&rgb)
                    .map_err(|e| AppError::Processing(e.to_string()))?;
            }
        }

        Ok(output)
    }
}
