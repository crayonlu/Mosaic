use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures_util::future::Ready;
use std::{error::Error as StdError, future::Future, pin::Pin, rc::Rc, time::Instant};

#[derive(Clone)]
pub struct LoggingMiddleware;

impl LoggingMiddleware {
    pub fn new() -> Self {
        Self
    }
}

impl Default for LoggingMiddleware {
    fn default() -> Self {
        Self::new()
    }
}

impl<S, B> Transform<S, ServiceRequest> for LoggingMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = LoggingMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        futures_util::future::ready(Ok(LoggingMiddlewareService {
            service: Rc::new(service),
        }))
    }
}

pub struct LoggingMiddlewareService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for LoggingMiddlewareService<S>
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
        let method = req.method().clone();
        let path = req.path().to_string();
        let query_string = req.query_string().to_string();
        let start_time = Instant::now();

        // 获取客户端 IP
        let client_ip = req
            .connection_info()
            .peer_addr()
            .map(|addr| addr.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        // 获取 User-Agent
        let user_agent = req
            .headers()
            .get("user-agent")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("unknown")
            .to_string();

        Box::pin(async move {
            match service.call(req).await {
                Ok(response) => {
                    let elapsed = start_time.elapsed();
                    let status = response.status().as_u16();
                    let elapsed_ms = elapsed.as_millis();

                    if status >= 400 {
                        // 错误状态码，记录详细日志
                        log::error!(
                            "[{}] {} {}{} - {} - {}ms - IP: {} - User-Agent: {}",
                            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
                            method,
                            path,
                            if query_string.is_empty() {
                                String::new()
                            } else {
                                format!("?{}", query_string)
                            },
                            status,
                            elapsed_ms,
                            client_ip,
                            user_agent
                        );
                    } else {
                        // 成功状态码，记录普通日志
                        log::info!(
                            "[{}] {} {}{} - {} - {}ms - IP: {}",
                            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
                            method,
                            path,
                            if query_string.is_empty() {
                                String::new()
                            } else {
                                format!("?{}", query_string)
                            },
                            status,
                            elapsed_ms,
                            client_ip
                        );
                    }

                    Ok(response)
                }
                Err(err) => {
                    let elapsed = start_time.elapsed();
                    let elapsed_ms = elapsed.as_millis();

                    // 记录错误详情
                    log::error!(
                        "[{}] {} {}{} - ERROR - {}ms - IP: {} - User-Agent: {}",
                        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
                        method,
                        path,
                        if query_string.is_empty() {
                            String::new()
                        } else {
                            format!("?{}", query_string)
                        },
                        elapsed_ms,
                        client_ip,
                        user_agent
                    );
                    log::error!("  Error: {}", err);
                    if let Some(source) = StdError::source(&err) {
                        log::error!("  Error cause: {}", source);
                    }

                    Err(err)
                }
            }
        })
    }
}

pub fn configure_logging() -> LoggingMiddleware {
    LoggingMiddleware::new()
}
