use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db;
use crate::error::AppError;

#[tauri::command]
pub fn get_settings(db_conn: State<'_, Mutex<Connection>>) -> Result<String, AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let settings = db::settings::get_setting(&conn, "app_settings")?;
    Ok(settings.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub fn update_settings(
    settings_json: String,
    db_conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = db_conn
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db::settings::set_setting(&conn, "app_settings", &settings_json)
}
