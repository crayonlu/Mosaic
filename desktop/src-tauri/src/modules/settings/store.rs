use crate::error::{AppError, AppResult};
use std::collections::HashMap;
use std::path::PathBuf;

pub struct SettingsStore {
    config_dir: PathBuf,
    settings_file: PathBuf,
}

impl SettingsStore {
    pub fn new(config_dir: PathBuf) -> Self {
        let settings_dir = config_dir.join("settings");
        let settings_file = settings_dir.join("settings.json");
        Self {
            config_dir,
            settings_file,
        }
    }

    fn settings_dir(&self) -> PathBuf {
        self.config_dir.join("settings")
    }

    pub fn load(&self) -> AppResult<HashMap<String, String>> {
        if !self.settings_file.exists() {
            return Ok(HashMap::new());
        }

        let content = std::fs::read_to_string(&self.settings_file)
            .map_err(|e| AppError::Internal(format!("Failed to read settings file: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| AppError::Internal(format!("Failed to parse settings: {}", e)))
    }

    pub fn save(&self, settings: &HashMap<String, String>) -> AppResult<()> {
        let settings_dir = self.settings_dir();
        std::fs::create_dir_all(&settings_dir).map_err(|e| {
            AppError::Internal(format!("Failed to create settings directory: {}", e))
        })?;

        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| AppError::Internal(format!("Failed to serialize settings: {}", e)))?;

        std::fs::write(&self.settings_file, content)
            .map_err(|e| AppError::Internal(format!("Failed to write settings file: {}", e)))?;

        Ok(())
    }

    pub fn get(&self, key: &str) -> AppResult<Option<String>> {
        let settings = self.load()?;
        Ok(settings.get(key).cloned())
    }

    pub fn get_all(&self) -> AppResult<HashMap<String, String>> {
        self.load()
    }

    pub fn set(&self, key: String, value: String) -> AppResult<()> {
        let mut settings = self.load()?;

        settings.insert(key, value);

        self.save(&settings)
    }

    pub fn delete(&self, key: &str) -> AppResult<()> {
        let mut settings = self.load()?;
        settings.remove(key);
        self.save(&settings)
    }
}
