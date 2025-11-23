use std::collections::HashMap;
use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};

use crate::error::AppError;
use crate::models::response::HttpResponse;

pub async fn execute_request(
    method: &str,
    url: &str,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_secs: u64,
    follow_redirects: bool,
    verify_ssl: bool,
) -> Result<HttpResponse, AppError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .redirect(if follow_redirects {
            reqwest::redirect::Policy::limited(10)
        } else {
            reqwest::redirect::Policy::none()
        })
        .danger_accept_invalid_certs(!verify_ssl)
        .build()?;

    let method = Method::from_bytes(method.as_bytes())
        .map_err(|e| AppError::Internal(format!("Invalid HTTP method: {}", e)))?;

    let mut request_builder = client.request(method, url);

    // Apply headers
    let mut header_map = HeaderMap::new();
    for (key, value) in &headers {
        if let (Ok(name), Ok(val)) = (
            HeaderName::from_bytes(key.as_bytes()),
            HeaderValue::from_str(value),
        ) {
            header_map.insert(name, val);
        }
    }
    request_builder = request_builder.headers(header_map);

    // Apply body
    if let Some(body_content) = body {
        if !body_content.is_empty() {
            request_builder = request_builder.body(body_content);
        }
    }

    let start = Instant::now();
    let response = request_builder.send().await?;
    let elapsed = start.elapsed().as_millis() as u64;

    let status_code = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("Unknown")
        .to_string();

    // Extract response headers
    let mut resp_headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            resp_headers.insert(key.to_string(), v.to_string());
        }
    }

    // Read body
    let body_bytes = response.bytes().await?;
    let size = body_bytes.len() as u64;
    let body = String::from_utf8_lossy(&body_bytes).to_string();

    Ok(HttpResponse {
        status_code,
        status_text,
        headers: resp_headers,
        body,
        size,
        time: elapsed,
    })
}
