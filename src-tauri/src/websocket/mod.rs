use std::collections::HashMap;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    pub direction: String, // "sent" | "received"
    pub data: String,
    pub timestamp: String,
    pub message_type: String, // "text" | "binary" | "ping" | "pong" | "close"
}

type WsSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    Message,
>;

pub struct WebSocketManager {
    connections: HashMap<String, Arc<Mutex<WsSink>>>,
    cancel_tokens: HashMap<String, tokio::sync::watch::Sender<bool>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
            cancel_tokens: HashMap::new(),
        }
    }

    pub async fn connect(
        &mut self,
        id: &str,
        url: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), AppError> {
        // Disconnect existing connection with same ID
        self.disconnect(id).await.ok();

        let (ws_stream, _) = tokio_tungstenite::connect_async(url)
            .await
            .map_err(|e| AppError::Internal(format!("WebSocket connection failed: {}", e)))?;

        let (write, mut read) = ws_stream.split();
        let sink = Arc::new(Mutex::new(write));

        self.connections.insert(id.to_string(), sink);

        let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);
        self.cancel_tokens.insert(id.to_string(), cancel_tx);

        let conn_id = id.to_string();

        // Spawn task to read incoming messages
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel_rx.changed() => {
                        if *cancel_rx.borrow() {
                            break;
                        }
                    }
                    msg = read.next() => {
                        match msg {
                            Some(Ok(message)) => {
                                let (data, msg_type) = match &message {
                                    Message::Text(t) => (t.to_string(), "text"),
                                    Message::Binary(b) => (format!("[binary: {} bytes]", b.len()), "binary"),
                                    Message::Ping(_) => ("ping".to_string(), "ping"),
                                    Message::Pong(_) => ("pong".to_string(), "pong"),
                                    Message::Close(frame) => {
                                        let reason = frame.as_ref()
                                            .map(|f| format!("code={} reason={}", f.code, f.reason))
                                            .unwrap_or_else(|| "closed".to_string());
                                        (reason, "close")
                                    }
                                    Message::Frame(_) => continue,
                                };

                                let ws_msg = WsMessage {
                                    direction: "received".to_string(),
                                    data,
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                    message_type: msg_type.to_string(),
                                };

                                let _ = app_handle.emit(
                                    &format!("ws-message-{}", conn_id),
                                    ws_msg,
                                );

                                if matches!(message, Message::Close(_)) {
                                    let _ = app_handle.emit(
                                        &format!("ws-disconnected-{}", conn_id),
                                        "closed by server",
                                    );
                                    break;
                                }
                            }
                            Some(Err(e)) => {
                                let _ = app_handle.emit(
                                    &format!("ws-disconnected-{}", conn_id),
                                    format!("error: {}", e),
                                );
                                break;
                            }
                            None => {
                                let _ = app_handle.emit(
                                    &format!("ws-disconnected-{}", conn_id),
                                    "stream ended",
                                );
                                break;
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn send(&self, id: &str, message: &str) -> Result<(), AppError> {
        let sink = self.connections.get(id).ok_or_else(|| {
            AppError::NotFound(format!("No WebSocket connection with id: {}", id))
        })?;

        let mut sink = sink.lock().await;
        sink.send(Message::Text(message.to_string()))
            .await
            .map_err(|e| AppError::Internal(format!("Failed to send WebSocket message: {}", e)))?;

        Ok(())
    }

    pub async fn disconnect(&mut self, id: &str) -> Result<(), AppError> {
        // Signal the reader task to stop
        if let Some(cancel) = self.cancel_tokens.remove(id) {
            let _ = cancel.send(true);
        }

        // Close the writer
        if let Some(sink) = self.connections.remove(id) {
            let mut sink = sink.lock().await;
            let _ = sink.send(Message::Close(None)).await;
        }

        Ok(())
    }

    pub fn is_connected(&self, id: &str) -> bool {
        self.connections.contains_key(id)
    }
}
