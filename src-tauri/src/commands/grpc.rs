use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::grpc;

/// Cached proto definitions — stored in Tauri managed state
pub struct ProtoCache {
    pub pools: HashMap<String, prost_reflect::DescriptorPool>,
}

impl ProtoCache {
    pub fn new() -> Self {
        Self {
            pools: HashMap::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GrpcResponse {
    pub body: String,
    pub messages: Option<Vec<String>>,
    pub time: u64,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn load_proto(
    proto_content: String,
    proto_cache: State<'_, Mutex<ProtoCache>>,
) -> Result<grpc::ProtoDefinition, AppError> {
    let (definition, pool) = grpc::parse_proto(&proto_content)?;

    // Cache the pool using a hash of the content
    let cache_key = format!("{:x}", md5_hash(&proto_content));
    let mut cache = proto_cache.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    cache.pools.insert(cache_key.clone(), pool);

    // Also store with key "latest" for convenience
    if let Some(pool) = cache.pools.get(&cache_key) {
        let cloned = pool.clone();
        cache.pools.insert("latest".to_string(), cloned);
    }

    Ok(definition)
}

#[tauri::command]
pub async fn grpc_unary_call(
    url: String,
    service: String,
    method: String,
    body_json: String,
    metadata: Vec<(String, String)>,
    proto_cache: State<'_, Mutex<ProtoCache>>,
) -> Result<GrpcResponse, AppError> {
    let pool = {
        let cache = proto_cache.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        cache
            .pools
            .get("latest")
            .cloned()
            .ok_or_else(|| AppError::NotFound("No proto loaded. Load a .proto file first.".to_string()))?
    };

    let method_desc = grpc::get_method_descriptor(&pool, &service, &method)?;
    let request_msg = grpc::json_to_message(&body_json, &method_desc.input())?;

    let start = std::time::Instant::now();

    let response_msg = grpc::client::grpc_unary(&url, &method_desc, request_msg, metadata).await?;

    let elapsed = start.elapsed().as_millis() as u64;
    let body = grpc::message_to_json(&response_msg)?;

    Ok(GrpcResponse {
        body,
        messages: None,
        time: elapsed,
        error: None,
    })
}

#[tauri::command]
pub async fn grpc_server_stream_call(
    url: String,
    service: String,
    method: String,
    body_json: String,
    metadata: Vec<(String, String)>,
    proto_cache: State<'_, Mutex<ProtoCache>>,
) -> Result<GrpcResponse, AppError> {
    let pool = {
        let cache = proto_cache.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        cache
            .pools
            .get("latest")
            .cloned()
            .ok_or_else(|| AppError::NotFound("No proto loaded. Load a .proto file first.".to_string()))?
    };

    let method_desc = grpc::get_method_descriptor(&pool, &service, &method)?;
    let request_msg = grpc::json_to_message(&body_json, &method_desc.input())?;

    let start = std::time::Instant::now();

    let response_msgs =
        grpc::client::grpc_server_stream(&url, &method_desc, request_msg, metadata).await?;

    let elapsed = start.elapsed().as_millis() as u64;

    let json_messages: Result<Vec<String>, AppError> = response_msgs
        .iter()
        .map(|msg| grpc::message_to_json(msg))
        .collect();
    let json_messages = json_messages?;

    let combined = if json_messages.len() == 1 {
        json_messages[0].clone()
    } else {
        format!("[{}]", json_messages.join(",\n"))
    };

    Ok(GrpcResponse {
        body: combined,
        messages: Some(json_messages),
        time: elapsed,
        error: None,
    })
}

/// Simple hash for cache key
fn md5_hash(input: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish()
}
