use crate::database::DBPool;
use crate::error::AppResult;
use crate::modules::stats::models::{
    HeatMapData, HeatMapQuery, SummaryData, SummaryQuery, TimelineData, TimelineQuery, TrendsData,
    TrendsQuery,
};
use crate::modules::stats::service;
use tauri::State;

#[tauri::command]
pub async fn get_heatmap(pool: State<'_, DBPool>, query: HeatMapQuery) -> AppResult<HeatMapData> {
    service::get_heatmap_data(pool.inner(), query).await
}

#[tauri::command]
pub async fn get_timeline(
    pool: State<'_, DBPool>,
    query: TimelineQuery,
) -> AppResult<TimelineData> {
    service::get_timeline_data(pool.inner(), query).await
}

#[tauri::command]
pub async fn get_trends(pool: State<'_, DBPool>, query: TrendsQuery) -> AppResult<TrendsData> {
    service::get_trends_data(pool.inner(), query).await
}

#[tauri::command]
pub async fn get_summary(pool: State<'_, DBPool>, query: SummaryQuery) -> AppResult<SummaryData> {
    service::get_summary_data(pool.inner(), query).await
}
