use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db;
use crate::error::AppError;
use crate::models::environment::Environment;

#[tauri::command]
pub fn create_environment(
    name: String,
    variables: serde_json::Value,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Environment, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let id = uuid::Uuid::new_v4().to_string();
    db::environments::create_environment(&conn, &id, &name, &variables)
}

#[tauri::command]
pub fn get_environments(
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<Environment>, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::environments::get_all_environments(&conn)
}

#[tauri::command]
pub fn update_environment(
    id: String,
    name: String,
    variables: serde_json::Value,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::environments::update_environment(&conn, &id, &name, &variables)
}

#[tauri::command]
pub fn delete_environment(
    id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::environments::delete_environment(&conn, &id)
}

#[tauri::command]
pub fn set_active_environment(
    id: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::environments::set_active_environment(&conn, &id)
}
