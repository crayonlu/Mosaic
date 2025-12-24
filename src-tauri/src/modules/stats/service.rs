use super::models::{
    HeatMapCell, HeatMapData, HeatMapQuery, MoodStats, SummaryData, SummaryQuery, TagStats,
    TimelineData, TimelineEntry, TimelineQuery, TrendPoint, TrendsData, TrendsQuery,
};
use crate::database::schema::MoodKey;
use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::diary::models::Diary;
use chrono::{Duration, NaiveDate};
use std::collections::HashMap;

pub async fn get_heatmap_data(pool: &DBPool, query: HeatMapQuery) -> AppResult<HeatMapData> {
    let start_date = NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d").map_err(|e| {
        crate::error::AppError::Unknown(format!("Invalid start date format: {}", e))
    })?;
    let end_date = NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d")
        .map_err(|e| crate::error::AppError::Unknown(format!("Invalid end date format: {}", e)))?;

    let diaries = get_diaries_in_range(pool, &query.start_date, &query.end_date).await?;
    let diary_map = create_diary_map(diaries);

    let mut cells = Vec::new();
    let mut current_date = start_date;

    while current_date <= end_date {
        let date_str = current_date.format("%Y-%m-%d").to_string();

        let cell = if let Some(diary) = diary_map.get(&date_str) {
            HeatMapCell {
                date: date_str,
                mood_key: Some(diary.mood_key.clone()),
                mood_score: Some(diary.mood_score),
                color: calculate_color(&diary.mood_key, diary.mood_score),
            }
        } else {
            HeatMapCell {
                date: date_str,
                mood_key: None,
                mood_score: None,
                color: "#ebedf0".to_string(),
            }
        };

        cells.push(cell);
        current_date += Duration::days(1);
    }

    Ok(HeatMapData {
        start_date: query.start_date,
        end_date: query.end_date,
        cells,
    })
}

async fn get_tags_in_date_range(
    pool: &DBPool,
    start_date: &str,
    end_date: &str,
) -> AppResult<Vec<String>> {
    let tags = sqlx::query_scalar::<_, String>(
        r#"
        SELECT tags
        FROM memos
        WHERE diary_date >= ? AND diary_date < ?
        AND tags != '[]' AND tags IS NOT NULL
        "#,
    )
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool)
    .await?;

    let mut all_tags = Vec::new();
    for tag_json in tags {
        if let Ok(tag_list) = serde_json::from_str::<Vec<String>>(&tag_json) {
            all_tags.extend(tag_list);
        }
    }

    Ok(all_tags)
}

async fn get_diaries_in_range(
    pool: &DBPool,
    start_date: &str,
    end_date: &str,
) -> AppResult<Vec<Diary>> {
    let diaries = sqlx::query_as::<_, Diary>(
        r#"
        SELECT date, summary, mood_key, mood_score, cover_image_id, memo_count, created_at, updated_at
        FROM diaries
        WHERE date >= ? AND date <= ?
        ORDER BY date
        "#,
    )
    .bind(start_date)
    .bind(end_date)
    .fetch_all(pool)
    .await?;

    Ok(diaries)
}

fn create_diary_map(diaries: Vec<Diary>) -> std::collections::HashMap<String, Diary> {
    let mut map = std::collections::HashMap::new();
    for diary in diaries {
        map.insert(diary.date.clone(), diary);
    }
    map
}

fn calculate_color(mood_key: &MoodKey, mood_score: i32) -> String {
    let hue = get_mood_base_hue(mood_key);
    let score_ratio = mood_score as f32 / 100.0;

    let saturation = score_ratio * 0.5 + 0.4; // 降低饱和度，0.4-0.9
    let lightness = 0.6 + score_ratio * 0.2; // 提高亮度，0.6-0.8

    hsl_to_hex(hue, saturation, lightness)
}

fn get_mood_base_hue(mood_key: &MoodKey) -> f32 {
    match mood_key {
        MoodKey::Joy => 45.0,
        MoodKey::Anger => 0.0,
        MoodKey::Sadness => 210.0,
        MoodKey::Calm => 180.0,
        MoodKey::Anxiety => 25.0,
        MoodKey::Focus => 160.0,
        MoodKey::Tired => 195.0,
        MoodKey::Neutral => 0.0,
        MoodKey::Custom(_) => 120.0,
    }
}

fn hsl_to_hex(h: f32, s: f32, l: f32) -> String {
    let h_norm = h / 360.0;
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - ((h_norm * 6.0) % 2.0 - 1.0).abs());
    let m = l - c / 2.0;

    let (r, g, b) = if h_norm < 1.0 / 6.0 {
        (c, x, 0.0)
    } else if h_norm < 2.0 / 6.0 {
        (x, c, 0.0)
    } else if h_norm < 3.0 / 6.0 {
        (0.0, c, x)
    } else if h_norm < 4.0 / 6.0 {
        (0.0, x, c)
    } else if h_norm < 5.0 / 6.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };

    let r_u8 = ((r + m) * 255.0).round() as u8;
    let g_u8 = ((g + m) * 255.0).round() as u8;
    let b_u8 = ((b + m) * 255.0).round() as u8;

    format!("#{:02x}{:02x}{:02x}", r_u8, g_u8, b_u8)
}

pub async fn get_timeline_data(pool: &DBPool, query: TimelineQuery) -> AppResult<TimelineData> {
    let diaries = get_diaries_in_range(pool, &query.start_date, &query.end_date).await?;

    let entries = diaries
        .into_iter()
        .map(|diary| {
            let color = if diary.mood_key != MoodKey::Neutral {
                calculate_color(&diary.mood_key, diary.mood_score)
            } else {
                "#ebedf0".to_string()
            };

            TimelineEntry {
                date: diary.date,
                mood_key: Some(diary.mood_key),
                mood_score: Some(diary.mood_score),
                summary: diary.summary,
                memo_count: diary.memo_count,
                color,
            }
        })
        .collect();

    Ok(TimelineData { entries })
}

pub async fn get_trends_data(pool: &DBPool, query: TrendsQuery) -> AppResult<TrendsData> {
    let diaries = get_diaries_in_range(pool, &query.start_date, &query.end_date).await?;
    let diary_map = create_diary_map(diaries);

    let start_date = NaiveDate::parse_from_str(&query.start_date, "%Y-%m-%d").map_err(|e| {
        crate::error::AppError::DateParse(format!("Invalid start date format: {}", e))
    })?;
    let end_date = NaiveDate::parse_from_str(&query.end_date, "%Y-%m-%d").map_err(|e| {
        crate::error::AppError::DateParse(format!("Invalid end date format: {}", e))
    })?;

    let mut points = Vec::new();
    let mut scores = Vec::new();
    let mut max_score = i32::MIN;
    let mut min_score = i32::MAX;

    let mut current_date = start_date;
    while current_date <= end_date {
        let date_str = current_date.format("%Y-%m-%d").to_string();

        let (color, score) = if let Some(diary) = diary_map.get(&date_str) {
            let color = calculate_color(&diary.mood_key, diary.mood_score);
            (color, Some(diary.mood_score))
        } else {
            ("#ebedf0".to_string(), None)
        };

        if let Some(s) = score {
            scores.push(s);
            max_score = max_score.max(s);
            min_score = min_score.min(s);
        }

        points.push(TrendPoint {
            date: date_str,
            mood_score: score,
            color,
        });

        current_date += Duration::days(1);
    }

    let avg_score = if scores.is_empty() {
        0.0
    } else {
        scores.iter().sum::<i32>() as f32 / scores.len() as f32
    };

    Ok(TrendsData {
        points,
        avg_score,
        max_score: if max_score == i32::MIN { 50 } else { max_score },
        min_score: if min_score == i32::MAX { 50 } else { min_score },
    })
}

pub async fn get_summary_data(pool: &DBPool, query: SummaryQuery) -> AppResult<SummaryData> {
    let start_date = format!("{:04}-{:02}-01", query.year, query.month);
    let end_date = if query.month == 12 {
        format!("{:04}-01-01", query.year + 1)
    } else {
        format!("{:04}-{:02}-01", query.year, query.month + 1)
    };

    let diaries = get_diaries_in_range(pool, &start_date, &end_date).await?;
    let total_days = diaries.len() as i32;
    let recorded_days = diaries
        .iter()
        .filter(|d| !d.summary.is_empty() || d.mood_score != 50)
        .count() as i32;

    let mut mood_counts = HashMap::new();
    let mut total_score = 0i32;
    let mut score_count = 0i32;

    for diary in &diaries {
        *mood_counts.entry(diary.mood_key.clone()).or_insert(0) += 1;
        total_score += diary.mood_score;
        score_count += 1;
    }

    let all_tags = get_tags_in_date_range(pool, &start_date, &end_date).await?;

    let avg_mood_score = if score_count > 0 {
        total_score as f32 / score_count as f32
    } else {
        50.0
    };

    let mut mood_distribution = Vec::new();
    let total_moods = mood_counts.values().sum::<i32>() as f32;

    for (mood_key, count) in mood_counts {
        let percentage = (count as f32 / total_moods) * 100.0;
        let color = calculate_color(&mood_key, 50);
        mood_distribution.push(MoodStats {
            mood_key,
            count,
            percentage,
            color,
        });
    }

    mood_distribution.sort_by(|a, b| b.count.cmp(&a.count));

    let mut tag_counts = HashMap::new();
    for tag in all_tags {
        *tag_counts.entry(tag).or_insert(0) += 1;
    }

    let mut top_tags: Vec<TagStats> = tag_counts
        .into_iter()
        .map(|(tag, count)| TagStats { tag, count })
        .collect();

    top_tags.sort_by(|a, b| b.count.cmp(&a.count));
    top_tags.truncate(10);

    let dominant_mood = mood_distribution.first().map(|m| m.mood_key.clone());

    Ok(SummaryData {
        year: query.year,
        month: query.month,
        total_days,
        recorded_days,
        avg_mood_score,
        mood_distribution,
        top_tags,
        dominant_mood,
    })
}
