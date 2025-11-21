use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::collection::Collection;

pub fn create_collection(
    conn: &Connection,
    id: &str,
    name: &str,
    description: &str,
    parent_id: Option<&str>,
) -> Result<Collection, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO collections (id, name, description, parent_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, description, parent_id, now, now],
    )?;

    Ok(Collection {
        id: id.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        parent_id: parent_id.map(|s| s.to_string()),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_all_collections(conn: &Connection) -> Result<Vec<Collection>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, parent_id, created_at, updated_at FROM collections ORDER BY name",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Collection {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            parent_id: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    let mut collections = Vec::new();
    for row in rows {
        collections.push(row?);
    }
    Ok(collections)
}

pub fn update_collection(
    conn: &Connection,
    id: &str,
    name: &str,
    description: &str,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let updated = conn.execute(
        "UPDATE collections SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
        params![name, description, now, id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound(format!("Collection {} not found", id)));
    }
    Ok(())
}

pub fn delete_collection(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn move_collection(
    conn: &Connection,
    id: &str,
    new_parent_id: Option<&str>,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE collections SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_parent_id, now, id],
    )?;
    Ok(())
}
