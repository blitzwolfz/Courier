use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub id: String,
    pub collection_id: Option<String>,
    pub name: String,
    pub method: String,
    pub url: String,
    pub params: serde_json::Value,
    pub headers: serde_json::Value,
    pub body: serde_json::Value,
    pub auth: serde_json::Value,
    pub pre_request_script: String,
    pub test_script: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}
