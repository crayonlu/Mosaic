use crate::middleware::get_user_id;
use crate::services::SyncService;
use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullRequest {
    pub client_id: String,
    pub cursors: HashMap<String, i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullResponse {
    pub cursors: HashMap<String, i64>,
    pub changes: EntityChangesMap,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityChangesMap {
    pub memo: EntityChangeSet,
    pub diary: EntityChangeSet,
    pub resource: EntityChangeSet,
    pub bot: EntityChangeSet,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityChangeSet {
    pub updated: Vec<serde_json::Value>,
    pub deleted_ids: Vec<String>,
}

pub async fn sync_pull(
    req: HttpRequest,
    body: web::Json<SyncPullRequest>,
    sync_service: web::Data<SyncService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match sync_service
        .pull(&user_id, &body.client_id, &body.cursors)
        .await
    {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_sync_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::scope("/sync").route("/pull", web::post().to(sync_pull)));
}
