use chrono::{DateTime, Datelike, NaiveDate, Utc, Weekday};
use chrono_tz::Tz;

const WEEKDATE_FULL: [&str; 7] = [
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
    "星期日",
];

pub fn now_formatted(tz: Tz) -> String {
    let now = Utc::now().with_timezone(&tz);
    format!(
        "{}年{}月{}日 {} {}",
        now.year(),
        now.month(),
        now.day(),
        WEEKDATE_FULL[weekday_index(now.weekday())],
        now.format("%H:%M")
    )
}

pub fn relative_time(ts_ms: i64, tz: Tz) -> String {
    let now = Utc::now().with_timezone(&tz);
    let now_ms = now.timestamp_millis();
    let diff_ms = (now_ms - ts_ms).max(0);

    let diff_secs = diff_ms / 1000;
    if diff_secs < 60 {
        return "刚刚".to_string();
    }
    let diff_mins = diff_secs / 60;
    if diff_mins < 60 {
        return format!("{}分钟前", diff_mins);
    }
    let diff_hours = diff_mins / 60;
    if diff_hours < 24 {
        return format!("{}小时前", diff_hours);
    }
    let diff_days = diff_hours / 24;
    if diff_days < 7 {
        return format!("{}天前", diff_days);
    }

    let ts_secs = ts_ms / 1000;
    let memo_date = DateTime::from_timestamp(ts_secs, 0)
        .map(|dt| dt.with_timezone(&tz).date_naive())
        .unwrap_or_else(|| now.date_naive());
    let today = now.date_naive();

    if memo_date.year() == today.year() {
        return format!("{}月{}日", memo_date.month(), memo_date.day());
    }

    format!(
        "{}年{}月{}日",
        memo_date.year(),
        memo_date.month(),
        memo_date.day()
    )
}

pub fn absolute_date(ts_ms: i64, tz: Tz) -> String {
    let ts_secs = ts_ms / 1000;
    DateTime::from_timestamp(ts_secs, 0)
        .map(|dt| {
            let local = dt.with_timezone(&tz);
            format!(
                "{}月{}日 {}",
                local.month(),
                local.day(),
                local.format("%H:%M")
            )
        })
        .unwrap_or_default()
}

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

fn weekday_index(w: Weekday) -> usize {
    match w {
        Weekday::Mon => 0,
        Weekday::Tue => 1,
        Weekday::Wed => 2,
        Weekday::Thu => 3,
        Weekday::Fri => 4,
        Weekday::Sat => 5,
        Weekday::Sun => 6,
    }
}

// Keep for callers that don't have access to AppSettingsService
pub fn tz_from_env() -> Tz {
    std::env::var("APP_TIMEZONE")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(chrono_tz::Asia::Shanghai)
}
