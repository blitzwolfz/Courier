use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db;
use crate::error::AppError;
use crate::models::collection::Collection;
use crate::models::request::HttpRequest;

#[tauri::command]
pub fn create_collection(
    name: String,
    description: Option<String>,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Collection, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let id = uuid::Uuid::new_v4().to_string();
    db::collections::create_collection(&conn, &id, &name, &description.unwrap_or_default(), None)
}

#[tauri::command]
pub fn get_collections(
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<Collection>, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::collections::get_all_collections(&conn)
}

#[tauri::command]
pub fn update_collection(
    id: String,
    name: String,
    description: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::collections::update_collection(&conn, &id, &name, &description)
}

#[tauri::command]
pub fn delete_collection(
    id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::collections::delete_collection(&conn, &id)
}

#[tauri::command]
pub fn create_request(
    request: HttpRequest,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::create_request(&conn, &request)
}

#[tauri::command]
pub fn get_requests(
    collection_id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<HttpRequest>, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::get_requests_by_collection(&conn, &collection_id)
}

#[tauri::command]
pub fn get_request(
    id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<HttpRequest, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::get_request_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_request(
    request: HttpRequest,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::update_request(&conn, &request)
}

#[tauri::command]
pub fn delete_request(
    id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::delete_request(&conn, &id)
}

#[tauri::command]
pub fn move_collection(
    id: String,
    new_parent_id: Option<String>,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::collections::move_collection(&conn, &id, new_parent_id.as_deref())
}

#[tauri::command]
pub fn move_request(
    id: String,
    new_collection_id: String,
    sort_order: i32,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::move_request(&conn, &id, &new_collection_id, sort_order)
}

#[tauri::command]
pub fn reorder_request(
    id: String,
    sort_order: i32,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::requests::reorder_request(&conn, &id, sort_order)
}
