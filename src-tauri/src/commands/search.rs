use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub result_type: String, // "collection" | "request" | "history"
    pub id: String,
    pub name: String,
    pub url: Option<String>,
    pub method: Option<String>,
    pub collection_name: Option<String>,
    pub collection_id: Option<String>,
}

#[tauri::command]
pub fn global_search(
    query: String,
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<SearchResult>, AppError> {
    let conn = db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let like_pattern = format!("%{}%", query);
    let mut results = Vec::new();

    // Search collections
    {
        let mut stmt = conn.prepare(
            "SELECT id, name FROM collections WHERE name LIKE ?1 ORDER BY name LIMIT 5"
        )?;
        let rows = stmt.query_map([&like_pattern], |row| {
            Ok(SearchResult {
                result_type: "collection".to_string(),
                id: row.get(0)?,
                name: row.get(1)?,
                url: None,
                method: None,
                collection_name: None,
                collection_id: None,
            })
        })?;
        for row in rows {
            results.push(row?);
        }
    }

    // Search saved requests
    {
        let mut stmt = conn.prepare(
            "SELECT r.id, r.name, r.url, r.method, r.collection_id, c.name as coll_name
             FROM requests r
             LEFT JOIN collections c ON r.collection_id = c.id
             WHERE r.name LIKE ?1 OR r.url LIKE ?1
             ORDER BY r.name LIMIT 10"
        )?;
        let rows = stmt.query_map([&like_pattern], |row| {
            Ok(SearchResult {
                result_type: "request".to_string(),
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                method: row.get(3)?,
                collection_id: row.get(4)?,
                collection_name: row.get(5)?,
            })
        })?;
        for row in rows {
            results.push(row?);
        }
    }

    // Search history
    {
        let mut stmt = conn.prepare(
            "SELECT id, url, method, status_code, timestamp
             FROM history
             WHERE url LIKE ?1
             ORDER BY timestamp DESC LIMIT 5"
        )?;
        let rows = stmt.query_map([&like_pattern], |row| {
            let url: String = row.get(1)?;
            let method: String = row.get(2)?;
            let status_code: i32 = row.get(3)?;
            Ok(SearchResult {
                result_type: "history".to_string(),
                id: row.get(0)?,
                name: format!("{} {} ({})", method, &url, status_code),
                url: Some(url),
                method: Some(method),
                collection_name: None,
                collection_id: None,
            })
        })?;
        for row in rows {
            results.push(row?);
        }
    }

    // Limit total results
    results.truncate(20);

    Ok(results)
}
