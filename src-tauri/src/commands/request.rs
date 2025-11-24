use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::http::client;
use crate::http::digest;
use crate::models::response::HttpResponse;
use crate::models::history::HistoryEntry;
use crate::scripting::{self, ScriptContext, ScriptResponseContext, TestResult};
use crate::db;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendRequestResult {
    pub response: HttpResponse,
    pub test_results: Vec<TestResult>,
    pub console_log: Vec<String>,
    pub script_error: Option<String>,
}

#[tauri::command]
pub async fn send_request(
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout: Option<u64>,
    follow_redirects: Option<bool>,
    verify_ssl: Option<bool>,
    pre_request_script: Option<String>,
    test_script: Option<String>,
    environment: Option<HashMap<String, String>>,
    db: State<'_, Mutex<Connection>>,
) -> Result<SendRequestResult, AppError> {
    let env_vars = environment.unwrap_or_default();
    let mut console_log = Vec::new();

    // Run pre-request script if provided
    let pre_script = pre_request_script.unwrap_or_default();
    let mut effective_vars: HashMap<String, String> = HashMap::new();
    let mut script_error: Option<String> = None;

    if !pre_script.trim().is_empty() {
        let ctx = ScriptContext {
            method: method.clone(),
            url: url.clone(),
            headers: headers.clone(),
            body: body.clone(),
            environment: env_vars.clone(),
            variables: HashMap::new(),
            response: None,
        };

        match scripting::execute_pre_request_script(&pre_script, &ctx) {
            Ok(result) => {
                console_log.extend(result.console_log);
                effective_vars = result.updated_variables;
                if let Some(err) = result.error {
                    script_error = Some(format!("Pre-request script error: {}", err));
                }
            }
            Err(e) => {
                script_error = Some(format!("Pre-request script error: {}", e));
            }
        }
    }

    // Check for digest auth special headers
    let digest_username = headers
        .iter()
        .find(|(k, _)| k == "X-Courier-Digest-Username")
        .map(|(_, v)| v.clone());
    let digest_password = headers
        .iter()
        .find(|(k, _)| k == "X-Courier-Digest-Password")
        .map(|(_, v)| v.clone());

    // Filter out internal digest headers before sending
    let clean_headers: Vec<(String, String)> = headers
        .iter()
        .filter(|(k, _)| !k.starts_with("X-Courier-Digest-"))
        .cloned()
        .collect();

    let response = if let (Some(username), Some(password)) = (digest_username, digest_password) {
        // Use digest authentication flow
        digest::execute_digest_request(
            &method,
            &url,
            clean_headers.clone(),
            body.clone(),
            &username,
            &password,
            timeout.unwrap_or(30),
            follow_redirects.unwrap_or(true),
            verify_ssl.unwrap_or(true),
        )
        .await?
    } else {
        // Normal request
        client::execute_request(
            &method,
            &url,
            clean_headers.clone(),
            body.clone(),
            timeout.unwrap_or(30),
            follow_redirects.unwrap_or(true),
            verify_ssl.unwrap_or(true),
        )
        .await?
    };

    // Run test script if provided
    let test_script_str = test_script.unwrap_or_default();
    let mut test_results = Vec::new();

    if !test_script_str.trim().is_empty() {
        let ctx = ScriptContext {
            method: method.clone(),
            url: url.clone(),
            headers: clean_headers.clone(),
            body: body.clone(),
            environment: env_vars,
            variables: effective_vars,
            response: Some(ScriptResponseContext {
                status: response.status_code,
                body: response.body.clone(),
                headers: response.headers.clone(),
                response_time: response.time,
            }),
        };

        match scripting::execute_test_script(&test_script_str, &ctx) {
            Ok(result) => {
                test_results = result.tests;
                console_log.extend(result.console_log);
                if let Some(err) = result.error {
                    if script_error.is_none() {
                        script_error = Some(format!("Test script error: {}", err));
                    }
                }
            }
            Err(e) => {
                if script_error.is_none() {
                    script_error = Some(format!("Test script error: {}", e));
                }
            }
        }
    }

    // Save to history
    let entry = HistoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        request_id: None,
        method: method.clone(),
        url: url.clone(),
        status_code: response.status_code as i32,
        response_time: response.time as i64,
        timestamp: chrono::Utc::now().to_rfc3339(),
        request_snapshot: serde_json::json!({
            "method": method,
            "url": url,
            "headers": clean_headers,
            "body": body,
        }),
        response_snapshot: serde_json::json!({
            "status_code": response.status_code,
            "status_text": response.status_text,
            "headers": response.headers,
            "size": response.size,
            "time": response.time,
        }),
    };

    if let Ok(conn) = db.lock() {
        let _ = db::history::save_history_entry(&conn, &entry);
    }

    Ok(SendRequestResult {
        response,
        test_results,
        console_log,
        script_error,
    })
}
