use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db;
use crate::error::AppError;
use crate::models::history::HistoryEntry;

#[tauri::command]
pub fn get_history(
    limit: Option<i64>,
    offset: Option<i64>,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<HistoryEntry>, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::history::get_history(&conn, limit.unwrap_or(100), offset.unwrap_or(0))
}

#[tauri::command]
pub fn clear_history(
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::history::clear_history(&conn)
}
