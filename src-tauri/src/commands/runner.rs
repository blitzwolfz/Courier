use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::db;
use crate::error::AppError;
use crate::http::client;
use crate::scripting::{self, ScriptContext, ScriptResponseContext, TestResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunnerOptions {
    pub iterations: Option<u32>,
    pub delay_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunnerProgress {
    pub runner_id: String,
    pub index: usize,
    pub total: usize,
    pub iteration: u32,
    pub total_iterations: u32,
    pub request_name: String,
    pub method: String,
    pub url: String,
    pub status_code: Option<u16>,
    pub response_time: Option<u64>,
    pub test_results: Vec<TestResult>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunnerSummary {
    pub runner_id: String,
    pub total_requests: usize,
    pub passed: usize,
    pub failed: usize,
    pub errors: usize,
    pub total_time: u64,
}

// Global cancellation flag
static RUNNER_CANCELLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub async fn run_collection(
    collection_id: String,
    options: Option<RunnerOptions>,
    app_handle: AppHandle,
    db_state: State<'_, Mutex<Connection>>,
) -> Result<RunnerSummary, AppError> {
    RUNNER_CANCELLED.store(false, std::sync::atomic::Ordering::SeqCst);

    let opts = options.unwrap_or(RunnerOptions {
        iterations: Some(1),
        delay_ms: Some(0),
    });
    let iterations = opts.iterations.unwrap_or(1).max(1);
    let delay_ms = opts.delay_ms.unwrap_or(0);
    let runner_id = uuid::Uuid::new_v4().to_string();

    // Fetch all requests in the collection
    let requests = {
        let conn = db_state
            .lock()
            .map_err(|_| AppError::Internal("Failed to lock database".to_string()))?;
        db::requests::get_requests_by_collection(&conn, &collection_id)?
    };

    let total = requests.len();
    let mut passed = 0usize;
    let mut failed = 0usize;
    let mut errors = 0usize;
    let mut total_time = 0u64;

    for iteration in 0..iterations {
        for (index, request) in requests.iter().enumerate() {
            if RUNNER_CANCELLED.load(std::sync::atomic::Ordering::SeqCst) {
                // Send cancelled summary
                let summary = RunnerSummary {
                    runner_id: runner_id.clone(),
                    total_requests: total * iterations as usize,
                    passed,
                    failed,
                    errors,
                    total_time,
                };
                let _ = app_handle.emit(&format!("runner-complete-{}", runner_id), &summary);
                return Ok(summary);
            }

            // Parse headers from JSON
            let headers: Vec<(String, String)> = if let Some(arr) = request.headers.as_array() {
                arr.iter()
                    .filter_map(|h| {
                        let key = h.get("key")?.as_str()?.to_string();
                        let value = h.get("value")?.as_str()?.to_string();
                        let enabled = h.get("enabled").and_then(|e| e.as_bool()).unwrap_or(true);
                        if enabled && !key.is_empty() {
                            Some((key, value))
                        } else {
                            None
                        }
                    })
                    .collect()
            } else {
                vec![]
            };

            // Parse body
            let body = request
                .body
                .get("content")
                .and_then(|c| c.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());

            let body_type = request
                .body
                .get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("none");

            let mut effective_headers = headers.clone();
            if body.is_some() && body_type != "none" {
                let content_type = match body_type {
                    "json" | "graphql" => "application/json",
                    "xml" => "application/xml",
                    "html" => "text/html",
                    "javascript" => "application/javascript",
                    "text" => "text/plain",
                    _ => "",
                };
                if !content_type.is_empty()
                    && !effective_headers
                        .iter()
                        .any(|(k, _)| k.eq_ignore_ascii_case("content-type"))
                {
                    effective_headers
                        .push(("Content-Type".to_string(), content_type.to_string()));
                }
            }

            // Run pre-request script
            if !request.pre_request_script.is_empty() {
                let ctx = ScriptContext {
                    method: request.method.clone(),
                    url: request.url.clone(),
                    headers: effective_headers.clone(),
                    body: body.clone(),
                    environment: HashMap::new(),
                    variables: HashMap::new(),
                    response: None,
                };
                let _ = scripting::execute_pre_request_script(&request.pre_request_script, &ctx);
            }

            // Execute HTTP request
            let result = client::execute_request(
                &request.method,
                &request.url,
                effective_headers.clone(),
                body.clone(),
                30,
                true,
                true,
            )
            .await;

            let mut progress = RunnerProgress {
                runner_id: runner_id.clone(),
                index,
                total,
                iteration: iteration + 1,
                total_iterations: iterations,
                request_name: request.name.clone(),
                method: request.method.clone(),
                url: request.url.clone(),
                status_code: None,
                response_time: None,
                test_results: vec![],
                error: None,
            };

            match result {
                Ok(response) => {
                    progress.status_code = Some(response.status_code);
                    progress.response_time = Some(response.time);
                    total_time += response.time;

                    // Run test script
                    if !request.test_script.is_empty() {
                        let ctx = ScriptContext {
                            method: request.method.clone(),
                            url: request.url.clone(),
                            headers: effective_headers,
                            body,
                            environment: HashMap::new(),
                            variables: HashMap::new(),
                            response: Some(ScriptResponseContext {
                                status: response.status_code,
                                body: response.body,
                                headers: response.headers,
                                response_time: response.time,
                            }),
                        };

                        match scripting::execute_test_script(&request.test_script, &ctx) {
                            Ok(test_result) => {
                                let all_passed =
                                    test_result.tests.iter().all(|t| t.passed);
                                if all_passed {
                                    passed += 1;
                                } else {
                                    failed += 1;
                                }
                                progress.test_results = test_result.tests;
                            }
                            Err(e) => {
                                progress.error = Some(format!("Test script error: {}", e));
                                errors += 1;
                            }
                        }
                    } else {
                        passed += 1;
                    }
                }
                Err(e) => {
                    progress.error = Some(format!("{}", e));
                    errors += 1;
                }
            }

            let _ = app_handle.emit(&format!("runner-progress-{}", runner_id), &progress);

            // Delay between requests
            if delay_ms > 0 && (index < total - 1 || iteration < iterations - 1) {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
            }
        }
    }

    let summary = RunnerSummary {
        runner_id: runner_id.clone(),
        total_requests: total * iterations as usize,
        passed,
        failed,
        errors,
        total_time,
    };

    let _ = app_handle.emit(&format!("runner-complete-{}", runner_id), &summary);

    Ok(summary)
}

#[tauri::command]
pub fn cancel_runner() -> Result<(), AppError> {
    RUNNER_CANCELLED.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}
