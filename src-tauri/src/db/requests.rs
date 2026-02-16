use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::request::HttpRequest;
use crate::db::parse_json_field;

pub fn create_request(
    conn: &Connection,
    request: &HttpRequest,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO requests (id, collection_id, name, method, url, params, headers, body, auth, pre_request_script, test_script, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            request.id,
            request.collection_id,
            request.name,
            request.method,
            request.url,
            request.params.to_string(),
            request.headers.to_string(),
            request.body.to_string(),
            request.auth.to_string(),
            request.pre_request_script,
            request.test_script,
            request.sort_order,
            request.created_at,
            request.updated_at,
        ],
    )?;
    Ok(())
}

fn read_request_from_row(row: &rusqlite::Row) -> rusqlite::Result<HttpRequest> {
    let params_str: String = row.get(5)?;
    let headers_str: String = row.get(6)?;
    let body_str: String = row.get(7)?;
    let auth_str: String = row.get(8)?;

    Ok(HttpRequest {
        id: row.get(0)?,
        collection_id: row.get(1)?,
        name: row.get(2)?,
        method: row.get(3)?,
        url: row.get(4)?,
        params: parse_json_field(&params_str, serde_json::json!([])),
        headers: parse_json_field(&headers_str, serde_json::json!([])),
        body: parse_json_field(&body_str, serde_json::json!({"type": "none", "content": ""})),
        auth: parse_json_field(&auth_str, serde_json::json!({"type": "none"})),
        pre_request_script: row.get(9)?,
        test_script: row.get(10)?,
        sort_order: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn get_requests_by_collection(
    conn: &Connection,
    collection_id: &str,
) -> Result<Vec<HttpRequest>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, name, method, url, params, headers, body, auth, pre_request_script, test_script, sort_order, created_at, updated_at FROM requests WHERE collection_id = ?1 ORDER BY sort_order, name",
    )?;

    let rows = stmt.query_map(params![collection_id], |row| {
        read_request_from_row(row)
    })?;

    let mut requests = Vec::new();
    for row in rows {
        requests.push(row?);
    }
    Ok(requests)
}

pub fn get_request_by_id(
    conn: &Connection,
    id: &str,
) -> Result<HttpRequest, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, name, method, url, params, headers, body, auth, pre_request_script, test_script, sort_order, created_at, updated_at FROM requests WHERE id = ?1",
    )?;

    stmt.query_row(params![id], |row| {
        read_request_from_row(row)
    }).map_err(|_| AppError::NotFound(format!("Request {} not found", id)))
}

pub fn update_request(
    conn: &Connection,
    request: &HttpRequest,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let updated = conn.execute(
        "UPDATE requests SET name = ?1, method = ?2, url = ?3, params = ?4, headers = ?5, body = ?6, auth = ?7, pre_request_script = ?8, test_script = ?9, sort_order = ?10, updated_at = ?11 WHERE id = ?12",
        params![
            request.name,
            request.method,
            request.url,
            request.params.to_string(),
            request.headers.to_string(),
            request.body.to_string(),
            request.auth.to_string(),
            request.pre_request_script,
            request.test_script,
            request.sort_order,
            now,
            request.id,
        ],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound(format!("Request {} not found", request.id)));
    }
    Ok(())
}

pub fn delete_request(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM requests WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn move_request(
    conn: &Connection,
    id: &str,
    new_collection_id: &str,
    sort_order: i32,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE requests SET collection_id = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
        params![new_collection_id, sort_order, now, id],
    )?;
    Ok(())
}

pub fn reorder_request(
    conn: &Connection,
    id: &str,
    sort_order: i32,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE requests SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
        params![sort_order, now, id],
    )?;
    Ok(())
}
