use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub request_id: Option<String>,
    pub method: String,
    pub url: String,
    pub status_code: i32,
    pub response_time: i64,
    pub timestamp: String,
    pub request_snapshot: serde_json::Value,
    pub response_snapshot: serde_json::Value,
}
