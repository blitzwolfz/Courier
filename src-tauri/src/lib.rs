mod codegen;
mod commands;
mod db;
mod error;
mod grpc;
mod http;
mod models;
mod scripting;
mod websocket;

use std::sync::Mutex;
use tauri::Manager;
use tokio::sync::Mutex as TokioMutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let conn = db::initialize(&app_data_dir)
                .expect("Failed to initialize database");

            app.manage(Mutex::new(conn));
            app.manage(TokioMutex::new(websocket::WebSocketManager::new()));
            app.manage(Mutex::new(commands::grpc::ProtoCache::new()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::request::send_request,
            commands::collection::create_collection,
            commands::collection::get_collections,
            commands::collection::update_collection,
            commands::collection::delete_collection,
            commands::collection::create_request,
            commands::collection::get_request,
            commands::collection::get_requests,
            commands::collection::update_request,
            commands::collection::delete_request,
            commands::environment::create_environment,
            commands::environment::get_environments,
            commands::environment::update_environment,
            commands::environment::delete_environment,
            commands::environment::set_active_environment,
            commands::history::get_history,
            commands::history::clear_history,
            commands::import_export::import_postman_collection,
            commands::import_export::export_postman_collection,
            commands::codegen::generate_code,
            commands::websocket::ws_connect,
            commands::websocket::ws_send,
            commands::websocket::ws_disconnect,
            commands::websocket::ws_is_connected,
            commands::scripting::execute_script,
            commands::runner::run_collection,
            commands::runner::cancel_runner,
            commands::grpc::load_proto,
            commands::grpc::grpc_unary_call,
            commands::grpc::grpc_server_stream_call,
            commands::search::global_search,
            commands::collection::move_collection,
            commands::collection::move_request,
            commands::collection::reorder_request,
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
