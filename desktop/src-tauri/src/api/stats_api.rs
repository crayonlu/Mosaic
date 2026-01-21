use super::client::ApiClient;
use crate::error::AppResult;
use crate::models::*;

pub struct StatsApi {
    client: ApiClient,
}

impl StatsApi {
    pub fn new(client: ApiClient) -> Self {
        Self { client }
    }

    pub async fn get_heatmap(&self, start_date: &str, end_date: &str) -> AppResult<HeatMapData> {
        self.client
            .request::<HeatMapData>(
                reqwest::Method::GET,
                &format!("/api/stats/heatmap?start_date={}&end_date={}", start_date, end_date),
                None,
            )
            .await
    }

    pub async fn get_timeline(&self, start_date: &str, end_date: &str) -> AppResult<TimelineData> {
        self.client
            .request::<TimelineData>(
                reqwest::Method::GET,
                &format!("/api/stats/timeline?start_date={}&end_date={}", start_date, end_date),
                None,
            )
            .await
    }

    pub async fn get_trends(&self, start_date: &str, end_date: &str) -> AppResult<TrendsData> {
        self.client
            .request::<TrendsData>(
                reqwest::Method::GET,
                &format!("/api/stats/trends?start_date={}&end_date={}", start_date, end_date),
                None,
            )
            .await
    }

    pub async fn get_summary(&self, year: i32, month: i32) -> AppResult<SummaryData> {
        self.client
            .request::<SummaryData>(
                reqwest::Method::GET,
                &format!("/api/stats/summary?year={}&month={}", year, month),
                None,
            )
            .await
    }
}
