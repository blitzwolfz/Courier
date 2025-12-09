use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db;
use crate::error::AppError;
use crate::models::collection::Collection;
use crate::models::request::HttpRequest;

#[tauri::command]
pub fn import_postman_collection(
    json_content: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Collection, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let postman: serde_json::Value = serde_json::from_str(&json_content)?;

    // Extract collection name from info.name
    let name = postman["info"]["name"]
        .as_str()
        .unwrap_or("Imported Collection")
        .to_string();

    let description = postman["info"]["description"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Create the collection
    let collection_id = uuid::Uuid::new_v4().to_string();
    let collection =
        db::collections::create_collection(&conn, &collection_id, &name, &description, None)?;

    // Parse items recursively
    if let Some(items) = postman["item"].as_array() {
        import_items(&conn, items, &collection_id, &mut 0)?;
    }

    Ok(collection)
}

fn import_items(
    conn: &Connection,
    items: &[serde_json::Value],
    collection_id: &str,
    sort_order: &mut i32,
) -> Result<(), AppError> {
    for item in items {
        // If item has "request", it's a request; if it has "item", it's a folder (skip folder nesting for now)
        if item.get("request").is_some() {
            import_request_item(conn, item, collection_id, *sort_order)?;
            *sort_order += 1;
        } else if let Some(sub_items) = item["item"].as_array() {
            // Folder — flatten into same collection
            import_items(conn, sub_items, collection_id, sort_order)?;
        }
    }
    Ok(())
}

fn import_request_item(
    conn: &Connection,
    item: &serde_json::Value,
    collection_id: &str,
    sort_order: i32,
) -> Result<(), AppError> {
    let name = item["name"].as_str().unwrap_or("Untitled").to_string();
    let req = &item["request"];

    let method = req["method"]
        .as_str()
        .unwrap_or("GET")
        .to_uppercase();

    // URL can be string or object
    let url = match &req["url"] {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Object(obj) => {
            obj.get("raw")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        }
        _ => String::new(),
    };

    // Headers
    let headers: Vec<serde_json::Value> = req["header"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|h| {
                    serde_json::json!({
                        "id": uuid::Uuid::new_v4().to_string(),
                        "key": h["key"].as_str().unwrap_or(""),
                        "value": h["value"].as_str().unwrap_or(""),
                        "enabled": !h.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false)
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // Body
    let body = if let Some(body_obj) = req.get("body") {
        let mode = body_obj["mode"].as_str().unwrap_or("none");
        match mode {
            "raw" => {
                let content = body_obj["raw"].as_str().unwrap_or("").to_string();
                let lang = body_obj["options"]["raw"]["language"]
                    .as_str()
                    .unwrap_or("text");
                let body_type = match lang {
                    "json" => "json",
                    "xml" => "xml",
                    "html" => "html",
                    "javascript" => "javascript",
                    _ => "text",
                };
                serde_json::json!({"type": body_type, "content": content})
            }
            _ => serde_json::json!({"type": "none", "content": ""}),
        }
    } else {
        serde_json::json!({"type": "none", "content": ""})
    };

    // Auth
    let auth = if let Some(auth_obj) = req.get("auth") {
        let auth_type = auth_obj["type"].as_str().unwrap_or("noauth");
        match auth_type {
            "bearer" => {
                let token = auth_obj["bearer"]
                    .as_array()
                    .and_then(|arr| arr.iter().find(|v| v["key"] == "token"))
                    .and_then(|v| v["value"].as_str())
                    .unwrap_or("");
                serde_json::json!({"type": "bearer", "bearer": {"token": token}})
            }
            "basic" => {
                let username = auth_obj["basic"]
                    .as_array()
                    .and_then(|arr| arr.iter().find(|v| v["key"] == "username"))
                    .and_then(|v| v["value"].as_str())
                    .unwrap_or("");
                let password = auth_obj["basic"]
                    .as_array()
                    .and_then(|arr| arr.iter().find(|v| v["key"] == "password"))
                    .and_then(|v| v["value"].as_str())
                    .unwrap_or("");
                serde_json::json!({"type": "basic", "basic": {"username": username, "password": password}})
            }
            _ => serde_json::json!({"type": "none"}),
        }
    } else {
        serde_json::json!({"type": "none"})
    };

    let now = chrono::Utc::now().to_rfc3339();
    let request = HttpRequest {
        id: uuid::Uuid::new_v4().to_string(),
        collection_id: Some(collection_id.to_string()),
        name,
        method,
        url,
        headers: serde_json::json!(headers),
        body,
        auth,
        pre_request_script: String::new(),
        test_script: String::new(),
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    };

    db::requests::create_request(conn, &request)
}

#[tauri::command]
pub fn export_postman_collection(
    collection_id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<String, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let collections = db::collections::get_all_collections(&conn)?;
    let collection = collections
        .iter()
        .find(|c| c.id == collection_id)
        .ok_or_else(|| AppError::NotFound(format!("Collection {} not found", collection_id)))?;

    let requests = db::requests::get_requests_by_collection(&conn, &collection_id)?;

    let items: Vec<serde_json::Value> = requests
        .iter()
        .map(|req| {
            let mut header_arr = Vec::new();
            if let Some(headers) = req.headers.as_array() {
                for h in headers {
                    header_arr.push(serde_json::json!({
                        "key": h["key"].as_str().unwrap_or(""),
                        "value": h["value"].as_str().unwrap_or(""),
                        "disabled": !h["enabled"].as_bool().unwrap_or(true)
                    }));
                }
            }

            let body_mode = req.body["type"].as_str().unwrap_or("none");
            let body = if body_mode != "none" {
                let lang = match body_mode {
                    "json" => "json",
                    "xml" => "xml",
                    "html" => "html",
                    "javascript" => "javascript",
                    _ => "text",
                };
                serde_json::json!({
                    "mode": "raw",
                    "raw": req.body["content"].as_str().unwrap_or(""),
                    "options": {"raw": {"language": lang}}
                })
            } else {
                serde_json::json!(null)
            };

            serde_json::json!({
                "name": req.name,
                "request": {
                    "method": req.method,
                    "header": header_arr,
                    "url": {"raw": req.url},
                    "body": body,
                },
                "response": []
            })
        })
        .collect();

    let postman = serde_json::json!({
        "info": {
            "name": collection.name,
            "description": collection.description,
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": items
    });

    Ok(serde_json::to_string_pretty(&postman)?)
}
