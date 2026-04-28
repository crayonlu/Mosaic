use crate::admin::activity_log::ActivityLog;
use crate::middleware::get_user_id;
use crate::models::{CreateBotRequest, ReorderBotsRequest, ReplyToBotRequest, UpdateBotRequest};
use crate::services::{bot_service::AiConfig, BotService};
use actix_web::{web, HttpRequest, HttpResponse};
use uuid::Uuid;

fn placeholder_ai_config() -> AiConfig {
    AiConfig {
        provider: String::new(),
        base_url: String::new(),
        api_key: String::new(),
        model: String::new(),
    }
}

pub async fn list_bots(req: HttpRequest, bot_service: web::Data<BotService>) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service.list_bots(&user_id).await {
        Ok(bots) => HttpResponse::Ok().json(bots),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn create_bot(
    req: HttpRequest,
    payload: web::Json<CreateBotRequest>,
    bot_service: web::Data<BotService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service.create_bot(&user_id, payload.into_inner()).await {
        Ok(bot) => {
            activity_log.record_info(
                "create_bot",
                "bot",
                Some(bot.id.to_string()),
                format!("创建了 Bot: {}", bot.name),
            );
            HttpResponse::Created().json(bot)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn update_bot(
    req: HttpRequest,
    path: web::Path<Uuid>,
    payload: web::Json<UpdateBotRequest>,
    bot_service: web::Data<BotService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let bot_id = path.into_inner();
    match bot_service
        .update_bot(&user_id, bot_id, payload.into_inner())
        .await
    {
        Ok(bot) => {
            activity_log.record_info(
                "update_bot",
                "bot",
                Some(bot.id.to_string()),
                format!("更新了 Bot: {}", bot.name),
            );
            HttpResponse::Ok().json(bot)
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn delete_bot(
    req: HttpRequest,
    path: web::Path<Uuid>,
    bot_service: web::Data<BotService>,
    activity_log: web::Data<ActivityLog>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    let bot_id = path.into_inner();
    match bot_service.delete_bot(&user_id, bot_id).await {
        Ok(_) => {
            activity_log.record_info(
                "delete_bot",
                "bot",
                Some(bot_id.to_string()),
                "删除了 Bot".to_string(),
            );
            HttpResponse::NoContent().finish()
        }
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn reorder_bots(
    req: HttpRequest,
    payload: web::Json<ReorderBotsRequest>,
    bot_service: web::Data<BotService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service
        .reorder_bots(&user_id, payload.into_inner())
        .await
    {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_bot_replies(
    req: HttpRequest,
    path: web::Path<Uuid>,
    bot_service: web::Data<BotService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service
        .get_bot_replies(&user_id, path.into_inner())
        .await
    {
        Ok(replies) => HttpResponse::Ok().json(replies),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn get_bot_thread(
    req: HttpRequest,
    path: web::Path<Uuid>,
    bot_service: web::Data<BotService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service
        .get_bot_thread(&user_id, path.into_inner())
        .await
    {
        Ok(thread) => HttpResponse::Ok().json(thread),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn trigger_replies(
    req: HttpRequest,
    path: web::Path<Uuid>,
    bot_service: web::Data<BotService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service
        .trigger_replies(&user_id, path.into_inner(), placeholder_ai_config())
        .await
    {
        Ok(_) => HttpResponse::Accepted().finish(),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub async fn reply_to_bot(
    req: HttpRequest,
    path: web::Path<Uuid>,
    payload: web::Json<ReplyToBotRequest>,
    bot_service: web::Data<BotService>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(e) => return HttpResponse::from_error(e),
    };

    match bot_service
        .reply_to_bot(
            &user_id,
            path.into_inner(),
            payload.into_inner(),
            placeholder_ai_config(),
        )
        .await
    {
        Ok(reply) => HttpResponse::Created().json(reply),
        Err(e) => HttpResponse::from_error(e),
    }
}

pub fn configure_bot_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/bots")
            .route(web::get().to(list_bots))
            .route(web::post().to(create_bot)),
    )
    .service(web::resource("/bots/reorder").route(web::put().to(reorder_bots)))
    .service(
        web::resource("/bots/{id}")
            .route(web::put().to(update_bot))
            .route(web::delete().to(delete_bot)),
    )
    .service(web::resource("/memos/{id}/bot-replies").route(web::get().to(get_bot_replies)))
    .service(web::resource("/bot-replies/{id}/thread").route(web::get().to(get_bot_thread)))
    .service(web::resource("/memos/{id}/trigger-replies").route(web::post().to(trigger_replies)))
    .service(web::resource("/bot-replies/{id}/reply").route(web::post().to(reply_to_bot)));
}
