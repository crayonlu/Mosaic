pub mod auth;
pub mod diaries;
pub mod memos;
pub mod resources;

pub use auth::configure_auth_routes;
pub use diaries::configure_diary_routes;
pub use memos::configure_memo_routes;
pub use resources::configure_resource_routes;
