use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteTextRequest {
    pub content: String,
    // context of the content
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriteTextRequest {
    pub text: String,
    pub style: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeTextRequest {
    pub text: String,
    pub max_length: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestTagsRequest {
    pub content: String,
    pub existing_tags: Option<Vec<String>>,
}
