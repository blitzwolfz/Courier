pub mod schema;
pub mod collections;
pub mod requests;
pub mod environments;
pub mod history;
pub mod settings;

use rusqlite::Connection;
use std::path::Path;

use crate::error::AppError;

pub fn initialize(app_data_dir: &Path) -> Result<Connection, AppError> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create data dir: {}", e)))?;

    let db_path = app_data_dir.join("courier.db");
    let conn = Connection::open(db_path)?;

    // Enable WAL mode for better concurrent reads
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    // Create tables
    conn.execute_batch(schema::CREATE_COLLECTIONS)?;
    conn.execute_batch(schema::CREATE_REQUESTS)?;
    conn.execute_batch(schema::CREATE_ENVIRONMENTS)?;
    conn.execute_batch(schema::CREATE_HISTORY)?;
    conn.execute_batch(schema::CREATE_SETTINGS)?;
    conn.execute_batch(schema::CREATE_SEARCH_INDEXES)?;

    Ok(conn)
}
