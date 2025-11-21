use rusqlite::{params, Connection};

use crate::error::AppError;
use crate::models::environment::Environment;

pub fn create_environment(
    conn: &Connection,
    id: &str,
    name: &str,
    variables: &serde_json::Value,
) -> Result<Environment, AppError> {
    conn.execute(
        "INSERT INTO environments (id, name, variables, is_active) VALUES (?1, ?2, ?3, 0)",
        params![id, name, variables.to_string()],
    )?;

    Ok(Environment {
        id: id.to_string(),
        name: name.to_string(),
        variables: variables.clone(),
        is_active: false,
    })
}

pub fn get_all_environments(conn: &Connection) -> Result<Vec<Environment>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, variables, is_active FROM environments ORDER BY name",
    )?;

    let rows = stmt.query_map([], |row| {
        let vars_str: String = row.get(2)?;
        let is_active: i32 = row.get(3)?;
        Ok(Environment {
            id: row.get(0)?,
            name: row.get(1)?,
            variables: serde_json::from_str(&vars_str).unwrap_or(serde_json::json!([])),
            is_active: is_active != 0,
        })
    })?;

    let mut envs = Vec::new();
    for row in rows {
        envs.push(row?);
    }
    Ok(envs)
}

pub fn update_environment(
    conn: &Connection,
    id: &str,
    name: &str,
    variables: &serde_json::Value,
) -> Result<(), AppError> {
    let updated = conn.execute(
        "UPDATE environments SET name = ?1, variables = ?2 WHERE id = ?3",
        params![name, variables.to_string(), id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound(format!("Environment {} not found", id)));
    }
    Ok(())
}

pub fn delete_environment(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM environments WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn set_active_environment(conn: &Connection, id: &str) -> Result<(), AppError> {
    // Deactivate all first
    conn.execute("UPDATE environments SET is_active = 0", [])?;
    // Activate the selected one
    conn.execute(
        "UPDATE environments SET is_active = 1 WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}
