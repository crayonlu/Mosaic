use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TagResponse {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Memo {
    pub id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub tags: serde_json::Value,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub diary_date: Option<chrono::NaiveDate>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceResponse {
    pub id: Uuid,
    pub memo_id: Option<Uuid>,
    pub filename: String,
    pub resource_type: String,
    pub mime_type: String,
    pub size: i64,
    pub storage_type: Option<String>,
    pub storage_path: Option<String>,
    pub url: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoWithResources {
    pub id: Uuid,
    pub content: String,
    pub tags: Vec<String>,
    pub is_archived: bool,
    pub diary_date: Option<chrono::NaiveDate>,
    pub created_at: i64,
    pub updated_at: i64,
    pub resources: Vec<ResourceResponse>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoRequest {
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub diary_date: Option<chrono::NaiveDate>,
    #[serde(default)]
    pub resource_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemoRequest {
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub resource_ids: Option<Vec<String>>,
    pub is_archived: Option<bool>,
    pub diary_date: Option<Option<chrono::NaiveDate>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub archived: Option<bool>,
    pub diary_date: Option<chrono::NaiveDate>,
    pub search: Option<String>,
}

#[derive(Debug)]
pub struct SearchMemosRequest {
    pub query: String,
    pub tags: Vec<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub is_archived: Option<bool>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

impl<'de> Deserialize<'de> for SearchMemosRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct SearchMemosRequestVisitor;

        impl<'de> Visitor<'de> for SearchMemosRequestVisitor {
            type Value = SearchMemosRequest;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a query map for memo search")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut query = String::new();
                let mut tags: Vec<String> = Vec::new();
                let mut start_date: Option<String> = None;
                let mut end_date: Option<String> = None;
                let mut is_archived: Option<bool> = None;
                let mut page: Option<u32> = None;
                let mut page_size: Option<u32> = None;

                while let Some((key, value)) = map.next_entry::<String, String>()? {
                    match key.as_str() {
                        "query" => query = value,
                        "tags" | "tags[]" => {
                            if !value.is_empty() {
                                tags.push(value);
                            }
                        }
                        "startDate" | "start_date" => start_date = Some(value),
                        "endDate" | "end_date" => end_date = Some(value),
                        "isArchived" | "is_archived" => {
                            let parsed = value.parse::<bool>().map_err(|_| {
                                de::Error::invalid_value(
                                    de::Unexpected::Str(&value),
                                    &"a boolean string (true/false)",
                                )
                            })?;
                            is_archived = Some(parsed);
                        }
                        "page" => {
                            let parsed = value.parse::<u32>().map_err(|_| {
                                de::Error::invalid_value(
                                    de::Unexpected::Str(&value),
                                    &"a positive integer",
                                )
                            })?;
                            page = Some(parsed);
                        }
                        "pageSize" | "page_size" => {
                            let parsed = value.parse::<u32>().map_err(|_| {
                                de::Error::invalid_value(
                                    de::Unexpected::Str(&value),
                                    &"a positive integer",
                                )
                            })?;
                            page_size = Some(parsed);
                        }
                        _ => {}
                    }
                }

                Ok(SearchMemosRequest {
                    query,
                    tags,
                    start_date,
                    end_date,
                    is_archived,
                    page,
                    page_size,
                })
            }
        }

        deserializer.deserialize_map(SearchMemosRequestVisitor)
    }
}

impl MemoWithResources {
    pub fn from_memo(memo: Memo, resources: Vec<ResourceResponse>) -> Self {
        let tags: Vec<String> = serde_json::from_value(memo.tags).unwrap_or_default();
        MemoWithResources {
            id: memo.id,
            content: memo.content,
            tags,
            is_archived: memo.is_archived,
            diary_date: memo.diary_date,
            created_at: memo.created_at,
            updated_at: memo.updated_at,
            resources,
        }
    }
}
