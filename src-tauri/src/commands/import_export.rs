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

    let postman: serde_json::Value = serde_json::from_str(&json_content)
        .map_err(|e| AppError::Internal(format!("Invalid JSON: {}", e)))?;

    // Validate basic Postman structure
    if postman.get("item").is_none() {
        return Err(AppError::Internal(
            "Invalid Postman collection: missing 'item' array".to_string(),
        ));
    }

    // Extract collection name from info.name
    let name = postman["info"]["name"]
        .as_str()
        .unwrap_or("Imported Collection")
        .to_string();

    let description = postman["info"]["description"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Create the root collection
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
        if item.get("request").is_some() {
            // This is a request item
            import_request_item(conn, item, collection_id, *sort_order)?;
            *sort_order += 1;
        } else if let Some(sub_items) = item["item"].as_array() {
            // This is a folder — create a sub-collection
            let folder_name = item["name"].as_str().unwrap_or("Folder").to_string();
            let folder_desc = item["description"].as_str().unwrap_or("").to_string();
            let folder_id = uuid::Uuid::new_v4().to_string();
            db::collections::create_collection(
                conn,
                &folder_id,
                &folder_name,
                &folder_desc,
                Some(collection_id),
            )?;
            // Recursively import into the sub-collection
            import_items(conn, sub_items, &folder_id, sort_order)?;
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

    // Parse query parameters from url.query array
    let params: Vec<serde_json::Value> = if let Some(url_obj) = req["url"].as_object() {
        url_obj
            .get("query")
            .and_then(|q| q.as_array())
            .map(|arr| {
                arr.iter()
                    .map(|q| {
                        serde_json::json!({
                            "id": uuid::Uuid::new_v4().to_string(),
                            "key": q["key"].as_str().unwrap_or(""),
                            "value": q["value"].as_str().unwrap_or(""),
                            "enabled": !q.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false)
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        Vec::new()
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
            "formdata" => {
                let content = body_obj["formdata"]
                    .as_array()
                    .map(|arr| serde_json::to_string(arr).unwrap_or_default())
                    .unwrap_or_default();
                serde_json::json!({"type": "form-data", "content": content})
            }
            "urlencoded" => {
                let content = body_obj["urlencoded"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .map(|p| {
                                format!(
                                    "{}={}",
                                    p["key"].as_str().unwrap_or(""),
                                    p["value"].as_str().unwrap_or("")
                                )
                            })
                            .collect::<Vec<_>>()
                            .join("&")
                    })
                    .unwrap_or_default();
                serde_json::json!({"type": "x-www-form-urlencoded", "content": content})
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
            "apikey" => {
                let key = auth_obj["apikey"]
                    .as_array()
                    .and_then(|arr| arr.iter().find(|v| v["key"] == "key"))
                    .and_then(|v| v["value"].as_str())
                    .unwrap_or("");
                let value = auth_obj["apikey"]
                    .as_array()
                    .and_then(|arr| arr.iter().find(|v| v["key"] == "value"))
                    .and_then(|v| v["value"].as_str())
                    .unwrap_or("");
                let add_to = auth_obj["apikey"]
                    .as_array()
                    .and_then(|arr| arr.iter().find(|v| v["key"] == "in"))
                    .and_then(|v| v["value"].as_str())
                    .unwrap_or("header");
                serde_json::json!({"type": "api-key", "apiKey": {"key": key, "value": value, "addTo": add_to}})
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
        params: serde_json::json!(params),
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

    let items = export_collection_items(&conn, &collection_id, &collections)?;

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

fn export_collection_items(
    conn: &Connection,
    collection_id: &str,
    all_collections: &[Collection],
) -> Result<Vec<serde_json::Value>, AppError> {
    let mut items = Vec::new();

    // Export sub-collections as folders
    let children: Vec<&Collection> = all_collections
        .iter()
        .filter(|c| c.parent_id.as_deref() == Some(collection_id))
        .collect();

    for child in children {
        let sub_items = export_collection_items(conn, &child.id, all_collections)?;
        items.push(serde_json::json!({
            "name": child.name,
            "description": child.description,
            "item": sub_items
        }));
    }

    // Export requests
    let requests = db::requests::get_requests_by_collection(conn, collection_id)?;
    for req in &requests {
        items.push(export_request_item(req));
    }

    Ok(items)
}

fn export_request_item(req: &HttpRequest) -> serde_json::Value {
    // Convert headers
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

    // Convert query params
    let mut query_arr = Vec::new();
    if let Some(params) = req.params.as_array() {
        for p in params {
            query_arr.push(serde_json::json!({
                "key": p["key"].as_str().unwrap_or(""),
                "value": p["value"].as_str().unwrap_or(""),
                "disabled": !p["enabled"].as_bool().unwrap_or(true)
            }));
        }
    }

    // Build URL object with query params
    let url = if query_arr.is_empty() {
        serde_json::json!({"raw": req.url})
    } else {
        serde_json::json!({"raw": req.url, "query": query_arr})
    };

    // Convert body
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

    // Convert auth
    let auth_type = req.auth["type"].as_str().unwrap_or("none");
    let auth = match auth_type {
        "bearer" => {
            let token = req.auth["bearer"]["token"].as_str().unwrap_or("");
            serde_json::json!({
                "type": "bearer",
                "bearer": [{"key": "token", "value": token, "type": "string"}]
            })
        }
        "basic" => {
            let username = req.auth["basic"]["username"].as_str().unwrap_or("");
            let password = req.auth["basic"]["password"].as_str().unwrap_or("");
            serde_json::json!({
                "type": "basic",
                "basic": [
                    {"key": "username", "value": username, "type": "string"},
                    {"key": "password", "value": password, "type": "string"}
                ]
            })
        }
        "api-key" => {
            let key = req.auth["apiKey"]["key"].as_str().unwrap_or("");
            let value = req.auth["apiKey"]["value"].as_str().unwrap_or("");
            let add_to = req.auth["apiKey"]["addTo"].as_str().unwrap_or("header");
            serde_json::json!({
                "type": "apikey",
                "apikey": [
                    {"key": "key", "value": key, "type": "string"},
                    {"key": "value", "value": value, "type": "string"},
                    {"key": "in", "value": add_to, "type": "string"}
                ]
            })
        }
        _ => serde_json::json!(null),
    };

    let mut request_obj = serde_json::json!({
        "method": req.method,
        "header": header_arr,
        "url": url,
    });

    if !body.is_null() {
        request_obj["body"] = body;
    }
    if !auth.is_null() {
        request_obj["auth"] = auth;
    }

    serde_json::json!({
        "name": req.name,
        "request": request_obj,
        "response": []
    })
}
