use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::ai::models::*;
use crate::modules::ai::provider::{create_provider, AIProvider};

pub async fn complete_text(
    pool: &DBPool,
    req: CompleteTextRequest,
) -> AppResult<CompleteTextResponse> {
    let provider = create_provider(pool).await?;
    let generated_text = provider.complete_text(&req).await?;

    Ok(CompleteTextResponse { generated_text })
}

pub async fn rewrite_text(
    pool: &DBPool,
    req: RewriteTextRequest,
) -> AppResult<RewriteTextResponse> {
    let provider = create_provider(pool).await?;
    let rewritten_text = provider.rewrite_text(&req).await?;

    Ok(RewriteTextResponse { rewritten_text })
}

pub async fn summarize_text(
    pool: &DBPool,
    req: SummarizeTextRequest,
) -> AppResult<SummarizeTextResponse> {
    let provider = create_provider(pool).await?;
    let summary = provider.summarize_text(&req).await?;

    Ok(SummarizeTextResponse { summary })
}

pub async fn suggest_tags(
    pool: &DBPool,
    req: SuggestTagsRequest,
) -> AppResult<SuggestTagsResponse> {
    let provider = create_provider(pool).await?;
    let tags_str = provider.suggest_tags(&req).await?;
    let tags = tags_str.split_whitespace().map(|s| s.to_string()).collect();
    Ok(SuggestTagsResponse { tags })
}