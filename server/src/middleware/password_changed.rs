use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::ErrorForbidden,
    Error, HttpMessage,
};
use futures_util::future::Ready;
use std::{future::Future, pin::Pin, rc::Rc};

use super::auth::Claims;

/// Middleware that rejects requests from users who have `must_change_password = true`.
/// Excluded paths (`/api/auth/change-password`, `/api/auth/me`) are handled via
/// Actix scope nesting — they sit outside this middleware's scope.
pub struct RequirePasswordChanged;

impl<S, B> Transform<S, ServiceRequest> for RequirePasswordChanged
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequirePasswordChangedService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        futures_util::future::ready(Ok(RequirePasswordChangedService {
            service: Rc::new(service),
        }))
    }
}

pub struct RequirePasswordChangedService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for RequirePasswordChangedService<S>
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
            let must_change = req.extensions().get::<Claims>().map(|c| c.mcp);

            match must_change {
                None => {
                    return Err(ErrorForbidden(
                        "Authentication required before accessing this resource",
                    ));
                }
                Some(true) => {
                    return Err(ErrorForbidden(
                        "Password change required before accessing this resource",
                    ));
                }
                _ => {}
            }

            service.call(req).await
        })
    }
}
