use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoWithResources {
    #[serde(flatten)]
    pub memo: crate::models::Memo,
    pub resources: Vec<crate::models::Resource>,
}
