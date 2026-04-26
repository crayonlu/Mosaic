use std::collections::VecDeque;
use std::sync::Mutex;

#[derive(Debug, Clone)]
pub struct ActivityEntry {
    pub timestamp: i64,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub level: String,
    pub detail: String,
}

pub struct ActivityLog {
    entries: Mutex<VecDeque<ActivityEntry>>,
    max_entries: usize,
}

impl ActivityLog {
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: Mutex::new(VecDeque::with_capacity(max_entries)),
            max_entries,
        }
    }

    pub fn record(&self, entry: ActivityEntry) {
        let mut entries = self.entries.lock().expect("ActivityLog lock");
        if entries.len() >= self.max_entries {
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    /// Convenience helper to record an info-level activity entry.
    pub fn record_info(
        &self,
        action: &str,
        entity_type: &str,
        entity_id: Option<String>,
        detail: String,
    ) {
        self.record(ActivityEntry {
            timestamp: chrono::Utc::now().timestamp_millis(),
            action: action.to_string(),
            entity_type: entity_type.to_string(),
            entity_id,
            level: "info".to_string(),
            detail,
        });
    }

    pub fn list(&self, limit: usize, level: Option<&str>) -> Vec<ActivityEntry> {
        let entries = self.entries.lock().expect("ActivityLog lock");
        let filtered: Vec<ActivityEntry> = match level {
            Some(lvl) => entries.iter().filter(|e| e.level == lvl).cloned().collect(),
            None => entries.iter().cloned().collect(),
        };
        let start = if filtered.len() > limit {
            filtered.len() - limit
        } else {
            0
        };
        filtered[start..].to_vec()
    }
}
