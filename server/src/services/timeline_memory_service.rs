use crate::models::RelatedMemoContext;
use crate::services::time_formatter;
use std::collections::BTreeMap;

#[derive(Clone, Default)]
pub struct TimelineMemoryService;

impl TimelineMemoryService {
    pub fn new() -> Self {
        Self
    }

    pub fn build_summary(&self, related_memos: &[RelatedMemoContext]) -> Option<String> {
        if related_memos.is_empty() {
            return None;
        }

        let mut ordered = related_memos.to_vec();
        ordered.sort_by_key(|memo| memo.created_at);
        ordered.dedup_by_key(|memo| memo.memo_id);

        let mut by_date: BTreeMap<chrono::NaiveDate, Vec<&RelatedMemoContext>> = BTreeMap::new();
        for memo in &ordered {
            let date = time_formatter::date_to_naive(memo.created_at);
            by_date.entry(date).or_default().push(memo);
        }

        let mut lines = Vec::new();
        for (_date, memos) in &by_date {
            let sample_ts = memos.first().map(|m| m.created_at).unwrap_or(0);
            let label = time_formatter::date_label(sample_ts);

            let combined: String = memos
                .iter()
                .map(|m| m.summary_excerpt.trim().to_string())
                .collect::<Vec<_>>()
                .join("；");

            let truncated: String = combined.chars().take(200).collect();
            lines.push(format!("{}：{}", label, truncated));
        }

        Some(lines.join("\n"))
    }
}
