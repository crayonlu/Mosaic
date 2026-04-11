use std::error::Error;
use std::time::Duration;

#[derive(Debug, Clone, Copy)]
pub enum ProxyMode {
    Direct,
    System,
}

impl ProxyMode {
    pub fn from_str(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "system" => Self::System,
            _ => Self::Direct,
        }
    }
}

pub fn build_client(timeout: Duration, proxy_mode: ProxyMode) -> Result<reqwest::Client, reqwest::Error> {
    let builder = reqwest::Client::builder().timeout(timeout);
    let builder = match proxy_mode {
        ProxyMode::Direct => builder.no_proxy(),
        ProxyMode::System => builder,
    };

    builder.build()
}

pub fn describe_reqwest_error(err: &reqwest::Error) -> String {
    let mut parts = Vec::new();

    if err.is_timeout() {
        parts.push("kind=timeout".to_string());
    }
    if err.is_connect() {
        parts.push("kind=connect".to_string());
    }
    if err.is_request() {
        parts.push("kind=request".to_string());
    }
    if err.is_body() {
        parts.push("kind=body".to_string());
    }
    if err.is_decode() {
        parts.push("kind=decode".to_string());
    }
    if let Some(status) = err.status() {
        parts.push(format!("status={}", status));
    }
    if let Some(url) = err.url() {
        parts.push(format!("url={}", url));
    }

    let mut source = err.source();
    let mut chain = Vec::new();
    while let Some(cause) = source {
        chain.push(cause.to_string());
        source = cause.source();
    }

    if !chain.is_empty() {
        parts.push(format!("cause={}", chain.join(" => ")));
    }

    parts.push(format!("message={}", err));
    parts.join(", ")
}
