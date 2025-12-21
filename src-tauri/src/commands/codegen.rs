use crate::codegen::{self, CodeGenRequest};
use crate::error::AppError;

#[tauri::command]
pub fn generate_code(
    language: String,
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<String, AppError> {
    let req = CodeGenRequest {
        method,
        url,
        headers,
        body,
        auth_header: None,
    };

    Ok(codegen::generate(&language, &req))
}
