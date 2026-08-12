use crate::middleware::get_user_id;
use crate::services::build_ai_system_prompt;
use crate::services::retry::with_retry;
use crate::services::{AiClient, UserAiConfigService};
use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SummarizeRequest {
    content: String,
}

#[derive(Serialize)]
pub struct SummarizeResponse {
    summary: String,
}

#[derive(Deserialize)]
pub struct SuggestTagsRequest {
    content: String,
    #[serde(default)]
    existing_tags: Vec<String>,
}

#[derive(Serialize)]
pub struct SuggestTagsResponse {
    tags: Vec<String>,
}

pub async fn summarize(
    req: HttpRequest,
    payload: web::Json<SummarizeRequest>,
    ai_client: web::Data<AiClient>,
    user_ai_config_service: web::Data<UserAiConfigService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(u) => u,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "error": "Invalid user ID" }))
        }
    };

    let ai_config = match user_ai_config_service.to_ai_config(&user_uuid).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "AI service not configured"
            }));
        }
    };

    let prompt = format!(
        "Summarize the following content in 1-2 sentences. \
         Be concise and capture the key point. \
         Use the same language as the provided content. \
         Output only the summary, no extra text.\n\nContent:\n{}",
        payload.content
    );

    let user_message = AiClient::build_user_message(&prompt, &[], &ai_config.provider);
    let system_prompt = build_ai_system_prompt();

    let reply = match with_retry(
        || {
            let client = ai_client.clone();
            let config = ai_config.clone();
            let system_prompt = system_prompt.clone();
            let user_message = user_message.clone();
            async move {
                client
                    .send_ai_messages(&config, system_prompt, vec![user_message], None)
                    .await
                    .map_err(|error| crate::error::AppError::Internal(error.to_string()))
            }
        },
        2,
        Duration::from_secs(60),
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("[AISummarize] AI call failed: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "AI service call failed"
            }));
        }
    };

    let summary = reply.content.trim().to_string();
    if summary.is_empty() {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "AI returned empty summary"
        }));
    }

    HttpResponse::Ok().json(SummarizeResponse { summary })
}

pub async fn suggest_tags(
    req: HttpRequest,
    payload: web::Json<SuggestTagsRequest>,
    ai_client: web::Data<AiClient>,
    user_ai_config_service: web::Data<UserAiConfigService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(u) => u,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "error": "Invalid user ID" }))
        }
    };

    let ai_config = match user_ai_config_service.to_ai_config(&user_uuid).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "AI service not configured"
            }));
        }
    };

    let existing_tags_hint = if payload.existing_tags.is_empty() {
        String::from("(no existing tags yet)")
    } else {
        payload.existing_tags.join(", ")
    };

    let prompt = format!(
        "You are a tagging assistant for a personal journal app. \
         Generate 1-4 concise tags based on the content below. \
         Prefer reusing tags from the existing tag list when they fit. \
         Only create new tags when none of the existing ones are appropriate. \
         Tags should be short (1-3 words), lowercase. \
         Use the same language as the provided content. \
         Respond with ONLY a JSON array of tag strings, e.g.: [\"work\", \"health\"]\n\n\
         Existing tags: {}\n\nContent:\n{}",
        existing_tags_hint, payload.content
    );

    let user_message = AiClient::build_user_message(&prompt, &[], &ai_config.provider);
    let system_prompt = build_ai_system_prompt();

    let reply = match with_retry(
        || {
            let client = ai_client.clone();
            let config = ai_config.clone();
            let system_prompt = system_prompt.clone();
            let user_message = user_message.clone();
            async move {
                client
                    .send_ai_messages(&config, system_prompt, vec![user_message], None)
                    .await
                    .map_err(|error| crate::error::AppError::Internal(error.to_string()))
            }
        },
        2,
        Duration::from_secs(60),
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("[AISuggestTags] AI call failed: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "AI service call failed"
            }));
        }
    };

    let tags = match AiClient::parse_tag_list(&reply.content) {
        Ok(tags) => tags,
        Err(error) => {
            log::warn!("[AISuggestTags] failed to parse AI response: {}", error);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "AI returned an invalid tag response"
            }));
        }
    };

    HttpResponse::Ok().json(SuggestTagsResponse { tags })
}

pub fn configure_ai_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/ai/summarize").route(web::post().to(summarize)))
        .service(web::resource("/ai/suggest-tags").route(web::post().to(suggest_tags)));
}
