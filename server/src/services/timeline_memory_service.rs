use crate::models::RelatedMemoContext;

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

        let first = ordered
            .first()
            .map(|memo| memo.summary_excerpt.clone())
            .unwrap_or_default();
        let last = ordered
            .last()
            .map(|memo| memo.summary_excerpt.clone())
            .unwrap_or_default();
        let lines = ordered
            .iter()
            .take(5)
            .map(|memo| format!("- {}", memo.summary_excerpt))
            .collect::<Vec<_>>()
            .join("\n");

        Some(format!(
            "起点：{}\n最新状态：{}\n相关时间线：\n{}",
            first, last, lines
        ))
    }
}
