use tauri::{AppHandle, State};
use tokio::sync::Mutex;

use crate::error::AppError;
use crate::websocket::WebSocketManager;

#[tauri::command]
pub async fn ws_connect(
    id: String,
    url: String,
    app_handle: AppHandle,
    ws_manager: State<'_, Mutex<WebSocketManager>>,
) -> Result<(), AppError> {
    let mut manager = ws_manager.lock().await;
    manager.connect(&id, &url, app_handle).await
}

#[tauri::command]
pub async fn ws_send(
    id: String,
    message: String,
    ws_manager: State<'_, Mutex<WebSocketManager>>,
) -> Result<(), AppError> {
    let manager = ws_manager.lock().await;
    manager.send(&id, &message).await
}

#[tauri::command]
pub async fn ws_disconnect(
    id: String,
    ws_manager: State<'_, Mutex<WebSocketManager>>,
) -> Result<(), AppError> {
    let mut manager = ws_manager.lock().await;
    manager.disconnect(&id).await
}

#[tauri::command]
pub async fn ws_is_connected(
    id: String,
    ws_manager: State<'_, Mutex<WebSocketManager>>,
) -> Result<bool, AppError> {
    let manager = ws_manager.lock().await;
    Ok(manager.is_connected(&id))
}
