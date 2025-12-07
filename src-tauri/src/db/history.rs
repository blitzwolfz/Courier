use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::history::HistoryEntry;

pub fn save_history_entry(
    conn: &Connection,
    entry: &HistoryEntry,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO history (id, request_id, method, url, status_code, response_time, timestamp, request_snapshot, response_snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            entry.id,
            entry.request_id,
            entry.method,
            entry.url,
            entry.status_code,
            entry.response_time,
            entry.timestamp,
            entry.request_snapshot.to_string(),
            entry.response_snapshot.to_string(),
        ],
    )?;
    Ok(())
}

pub fn get_history(
    conn: &Connection,
    limit: i64,
    offset: i64,
) -> Result<Vec<HistoryEntry>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, request_id, method, url, status_code, response_time, timestamp, request_snapshot, response_snapshot FROM history ORDER BY timestamp DESC LIMIT ?1 OFFSET ?2",
    )?;

    let rows = stmt.query_map(params![limit, offset], |row| {
        let req_str: String = row.get(7)?;
        let res_str: String = row.get(8)?;
        Ok(HistoryEntry {
            id: row.get(0)?,
            request_id: row.get(1)?,
            method: row.get(2)?,
            url: row.get(3)?,
            status_code: row.get(4)?,
            response_time: row.get(5)?,
            timestamp: row.get(6)?,
            request_snapshot: serde_json::from_str(&req_str).unwrap_or(serde_json::json!({})),
            response_snapshot: serde_json::from_str(&res_str).unwrap_or(serde_json::json!({})),
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }
    Ok(entries)
}

pub fn clear_history(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM history", [])?;
    Ok(())
}
