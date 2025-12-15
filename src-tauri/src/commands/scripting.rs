use std::collections::HashMap;

use crate::error::AppError;
use crate::scripting::{self, ScriptContext, ScriptResponseContext};

#[tauri::command]
pub fn execute_script(
    script: String,
    script_type: String,
    method: Option<String>,
    url: Option<String>,
    headers: Option<Vec<(String, String)>>,
    body: Option<String>,
    response_status: Option<u16>,
    response_body: Option<String>,
    response_headers: Option<HashMap<String, String>>,
    response_time: Option<u64>,
) -> Result<serde_json::Value, AppError> {
    let response = if script_type == "test" {
        Some(ScriptResponseContext {
            status: response_status.unwrap_or(0),
            body: response_body.unwrap_or_default(),
            headers: response_headers.unwrap_or_default(),
            response_time: response_time.unwrap_or(0),
        })
    } else {
        None
    };

    let ctx = ScriptContext {
        method: method.unwrap_or_else(|| "GET".to_string()),
        url: url.unwrap_or_default(),
        headers: headers.unwrap_or_default(),
        body,
        environment: HashMap::new(),
        variables: HashMap::new(),
        response,
    };

    if script_type == "test" {
        let result = scripting::execute_test_script(&script, &ctx)?;
        serde_json::to_value(result)
            .map_err(|e| AppError::Internal(format!("Failed to serialize test result: {}", e)))
    } else {
        let result = scripting::execute_pre_request_script(&script, &ctx)?;
        serde_json::to_value(result)
            .map_err(|e| AppError::Internal(format!("Failed to serialize script result: {}", e)))
    }
}
