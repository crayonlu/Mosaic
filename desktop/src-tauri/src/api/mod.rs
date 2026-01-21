pub mod client;
pub mod auth_api;
pub mod memo_api;
pub mod diary_api;
pub mod resource_api;
pub mod user_api;
pub mod stats_api;

pub use client::ApiClient;
pub use auth_api::{AuthApi, LoginRequest, LoginResponse};
pub use memo_api::{MemoApi, CreateMemoRequest, UpdateMemoRequest};
pub use diary_api::{DiaryApi, CreateOrUpdateDiaryRequest, UpdateDiarySummaryRequest, UpdateDiaryMoodRequest};
pub use resource_api::ResourceApi;
pub use user_api::{UserApi, UpdateUserRequest, UpdateAvatarRequest};
pub use stats_api::StatsApi;
