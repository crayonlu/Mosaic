use std::future::Future;
use std::time::Duration;

use crate::error::AppError;

/// Execute an async operation with retry + exponential backoff + per-attempt timeout.
///
/// - `operation`: A closure that returns a Future. Re-invoked on each retry.
/// - `max_retries`: Number of retries AFTER the initial attempt (0 = no retry).
/// - `timeout`: Per-attempt timeout.
///
/// Backoff: sleep(2^attempt seconds) for attempt in 1..=max_retries.
pub async fn with_retry<T, F, Fut>(
    operation: F,
    max_retries: u32,
    timeout: Duration,
) -> Result<T, AppError>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, AppError>>,
{
    let mut last_err = None;
    let total_attempts = max_retries + 1;

    for attempt in 0..total_attempts {
        if attempt > 0 {
            let backoff = Duration::from_secs(2u64.pow(attempt));
            tokio::time::sleep(backoff).await;
        }

        match tokio::time::timeout(timeout, operation()).await {
            Ok(Ok(val)) => return Ok(val),
            Ok(Err(e)) => {
                log::warn!(
                    "[Retry] Attempt {}/{} failed: {}",
                    attempt + 1,
                    total_attempts,
                    e
                );
                last_err = Some(e);
            }
            Err(_elapsed) => {
                log::warn!(
                    "[Retry] Attempt {}/{} timed out after {:?}",
                    attempt + 1,
                    total_attempts,
                    timeout
                );
                last_err = Some(AppError::Timeout);
            }
        }
    }

    Err(last_err.unwrap_or(AppError::Timeout))
}
