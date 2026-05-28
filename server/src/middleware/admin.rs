use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::ErrorForbidden,
    Error, HttpMessage,
};
use futures_util::future::Ready;
use std::{future::Future, pin::Pin, rc::Rc};

use super::auth::Claims;

pub struct RequireAdmin;

impl<S, B> Transform<S, ServiceRequest> for RequireAdmin
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequireAdminService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        futures_util::future::ready(Ok(RequireAdminService {
            service: Rc::new(service),
        }))
    }
}

pub struct RequireAdminService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for RequireAdminService<S>
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
        let service = self.service.clone();

        Box::pin(async move {
            let is_admin = req
                .extensions()
                .get::<Claims>()
                .map(|c| c.role == "admin")
                .unwrap_or(false);

            if !is_admin {
                return Err(ErrorForbidden("Admin access required"));
            }

            service.call(req).await
        })
    }
}
