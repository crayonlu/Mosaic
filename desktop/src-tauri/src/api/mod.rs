pub mod auth_api;
pub mod client;
pub mod diary_api;
pub mod memo_api;
pub mod resource_api;
pub mod stats_api;
pub mod user_api;

pub use auth_api::{AuthApi, LoginResponse};
pub use client::ApiClient;
pub use diary_api::{
    CreateOrUpdateDiaryRequest, DiaryApi, UpdateDiaryMoodRequest, UpdateDiarySummaryRequest,
};
pub use memo_api::{CreateMemoRequest, MemoApi, UpdateMemoRequest};
pub use resource_api::ResourceApi;
pub use stats_api::StatsApi;
pub use user_api::{UpdateUserRequest, UserApi};
