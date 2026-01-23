use crate::error::AppError;
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::ErrorUnauthorized,
    Error, HttpMessage, HttpRequest,
};
use futures_util::future::Ready;
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;
use std::{future::Future, pin::Pin, rc::Rc};

#[derive(Debug, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
}

#[derive(Clone)]
pub struct AuthMiddleware {
    jwt_secret: String,
}

impl AuthMiddleware {
    pub fn new(jwt_secret: String) -> Self {
        Self { jwt_secret }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        futures_util::future::ready(Ok(AuthMiddlewareService {
            service: Rc::new(service),
            jwt_secret: self.jwt_secret.clone(),
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: Rc<S>,
    jwt_secret: String,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let jwt_secret = self.jwt_secret.clone();
        let service = self.service.clone();

        Box::pin(async move {
            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|h| h.to_str().ok());

            if let Some(auth_header) = auth_header {
                if let Some(token) = auth_header.strip_prefix("Bearer ") {
                    match decode::<Claims>(
                        token,
                        &DecodingKey::from_secret(jwt_secret.as_ref()),
                        &Validation::default(),
                    ) {
                        Ok(token_data) => {
                            req.extensions_mut().insert(token_data.claims);
                            return service.call(req).await;
                        }
                        Err(_) => {
                            return Err(
                                ErrorUnauthorized(AppError::InvalidToken.to_string()).into()
                            );
                        }
                    }
                }
            }

            Err(ErrorUnauthorized("Unauthorized".to_string()).into())
        })
    }
}

pub fn get_user_id(req: &HttpRequest) -> Result<String, Error> {
    req.extensions()
        .get::<Claims>()
        .map(|claims| claims.sub.clone())
        .ok_or_else(|| ErrorUnauthorized("Unauthorized".to_string()).into())
}
