use chrono::{DateTime, Datelike, NaiveDate, Utc};
use chrono_tz::Tz;

pub fn date_label(ts_ms: i64, tz: Tz) -> String {
    let now = Utc::now().with_timezone(&tz);
    let today = now.date_naive();
    let ts_secs = ts_ms / 1000;
    let memo_date = DateTime::from_timestamp(ts_secs, 0)
        .map(|dt| dt.with_timezone(&tz).date_naive())
        .unwrap_or(today);
    let diff_days = (today - memo_date).num_days();

    if diff_days == 0 {
        "今天".to_string()
    } else if diff_days == 1 {
        "昨天".to_string()
    } else if diff_days < 7 {
        format!("{}天前", diff_days)
    } else {
        format!("{}月{}日", memo_date.month(), memo_date.day())
    }
}

pub fn date_to_naive(ts_ms: i64, tz: Tz) -> NaiveDate {
    let ts_secs = ts_ms / 1000;
    DateTime::from_timestamp(ts_secs, 0)
        .map(|dt| dt.with_timezone(&tz).date_naive())
        .unwrap_or_else(|| Utc::now().with_timezone(&tz).date_naive())
}
