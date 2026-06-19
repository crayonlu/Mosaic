use crate::middleware::get_user_id;
use crate::services::build_ai_system_prompt;
use crate::services::{AiClient, UserAiConfigService};
use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
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

    let reply = match ai_client
        .send_ai_messages(&ai_config, system_prompt, vec![user_message], None)
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

    let reply = match ai_client
        .send_ai_messages(&ai_config, system_prompt, vec![user_message], None)
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

    let mut raw = reply.content.trim().to_string();
    if raw.is_empty() {
        return HttpResponse::Ok().json(SuggestTagsResponse { tags: vec![] });
    }

    // Strip markdown code fences if present
    raw = raw
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    // Extract JSON array brackets for robust parsing (handles text before/after array)
    let start = raw.find('[').unwrap_or(0);
    let end = raw.rfind(']').map(|i| i + 1).unwrap_or(raw.len());

    // Try to parse JSON array from response
    let mut tags: Vec<String> = match serde_json::from_str(&raw[start..end]) {
        Ok(t) => t,
        Err(_) => {
            // Fallback: split by common delimiters
            let mut fallback: Vec<String> = raw
                .split([',', '\n'])
                .map(|s| s.trim().trim_matches('"').trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            fallback.sort();
            fallback.dedup();
            fallback
        }
    };

    tags.sort();
    tags.dedup();

    HttpResponse::Ok().json(SuggestTagsResponse { tags })
}

pub fn configure_ai_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/ai/summarize").route(web::post().to(summarize)))
        .service(web::resource("/ai/suggest-tags").route(web::post().to(suggest_tags)));
}
