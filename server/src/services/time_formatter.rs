use chrono::{Datelike, FixedOffset, Local, NaiveDate, NaiveDateTime, Weekday};

const WEEKDATE_FULL: [&str; 7] = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

pub fn now_formatted() -> String {
    let now = Local::now();
    format!(
        "{}年{}月{}日 {} {}",
        now.year(),
        now.month(),
        now.day(),
        WEEKDATE_FULL[weekday_index(now.weekday())],
        now.format("%H:%M")
    )
}

pub fn relative_time(ts_ms: i64) -> String {
    let now = Local::now();
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

    let tz = timezone_offset();
    let ts_secs = ts_ms / 1000;
    let memo_dt = NaiveDateTime::from_timestamp_opt(ts_secs, ((ts_ms % 1000) * 1_000_000) as u32)
        .and_then(|dt| dt.and_local_timezone(tz).earliest())
        .unwrap_or_else(|| Local::now().into());

    let memo_date = memo_dt.date_naive();
    let today = now.date_naive();

    if memo_date.year() == today.year() {
        if memo_date.month() == today.month() {
            return format!("{}月{}日", memo_date.month(), memo_date.day());
        }
        return format!("{}月{}日", memo_date.month(), memo_date.day());
    }

    format!("{}年{}月{}日", memo_date.year(), memo_date.month(), memo_date.day())
}

pub fn absolute_date(ts_ms: i64) -> String {
    let tz = timezone_offset();
    let ts_secs = ts_ms / 1000;
    NaiveDateTime::from_timestamp_opt(ts_secs, ((ts_ms % 1000) * 1_000_000) as u32)
        .and_then(|dt| dt.and_local_timezone(tz).earliest())
        .map(|dt| {
            format!(
                "{}月{}日 {}",
                dt.month(),
                dt.day(),
                dt.format("%H:%M")
            )
        })
        .unwrap_or_default()
}

pub fn date_label(ts_ms: i64) -> String {
    let tz = timezone_offset();
    let ts_secs = ts_ms / 1000;
    let memo_dt = NaiveDateTime::from_timestamp_opt(ts_secs, ((ts_ms % 1000) * 1_000_000) as u32)
        .and_then(|dt| dt.and_local_timezone(tz).earliest())
        .unwrap_or_else(|| Local::now().into());

    let memo_date = memo_dt.date_naive();
    let today = Local::now().date_naive();
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

pub fn date_to_naive(ts_ms: i64) -> NaiveDate {
    let tz = timezone_offset();
    let ts_secs = ts_ms / 1000;
    NaiveDateTime::from_timestamp_opt(ts_secs, ((ts_ms % 1000) * 1_000_000) as u32)
        .and_then(|dt| dt.and_local_timezone(tz).earliest())
        .map(|dt| dt.date_naive())
        .unwrap_or_else(|| Local::now().date_naive())
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

fn timezone_offset() -> FixedOffset {
    let local = Local::now();
    *local.offset()
}
