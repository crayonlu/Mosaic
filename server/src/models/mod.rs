use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiaryWithMemosResponse {
    pub date: chrono::NaiveDate,
    pub summary: String,
    pub mood_key: String,
    pub mood_score: i32,
    pub cover_image_id: Option<uuid::Uuid>,
    pub created_at: i64,
    pub updated_at: i64,
    pub memos: Vec<MemoWithResources>,
}

pub mod diary;
pub mod memo;
pub mod resource;
pub mod stats;
pub mod user;

pub use diary::{CreateDiaryRequest, Diary, DiaryListQuery, DiaryResponse, UpdateDiaryRequest};
pub use memo::{CreateMemoRequest, Memo, MemoListQuery, MemoResponse, MemoWithResources, ResourceResponse as MemoResourceResponse, UpdateMemoRequest};
pub use resource::{
    ConfirmUploadRequest, CreateResourceRequest, PresignedUploadResponse, Resource,
    ResourceResponse,
};
pub use stats::{
    HeatMapData, MoodData, SummaryData, TagData, TimelineData, TimelineEntry, TrendsData,
};
pub use user::{
    ChangePasswordRequest, LoginRequest, LoginResponse, RefreshTokenRequest, RefreshTokenResponse,
    User, UserResponse,
};
