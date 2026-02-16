import { invoke } from '@tauri-apps/api/core';
import type { RequestData } from '../types/request';
import type { Collection } from '../types/collection';
import type { Environment } from '../types/environment';

// HTTP Request - returns SendRequestResult from Rust
export interface SendRequestResult {
  response: {
    status_code: number;
    status_text: string;
    headers: Record<string, string>;
    body: string;
    size: number;
    time: number;
  };
  test_results: { name: string; passed: boolean; error: string | null }[];
  console_log: string[];
  script_error: string | null;
}

export async function sendRequest(
  method: string,
  url: string,
  headers: [string, string][],
  body: string | null,
  options?: {
    timeout?: number;
    followRedirects?: boolean;
    verifySsl?: boolean;
    preRequestScript?: string;
    testScript?: string;
    environment?: Record<string, string>;
  }
): Promise<SendRequestResult> {
  return invoke('send_request', {
    method,
    url,
    headers,
    body,
    timeout: options?.timeout ?? 30,
    followRedirects: options?.followRedirects ?? true,
    verifySsl: options?.verifySsl ?? true,
    preRequestScript: options?.preRequestScript ?? null,
    testScript: options?.testScript ?? null,
    environment: options?.environment ?? null,
  });
}

// Script execution
export async function executeScript(
  script: string,
  scriptType: 'pre-request' | 'test',
  context?: {
    method?: string;
    url?: string;
    headers?: [string, string][];
    body?: string | null;
    responseStatus?: number;
    responseBody?: string;
    responseHeaders?: Record<string, string>;
    responseTime?: number;
  }
): Promise<unknown> {
  return invoke('execute_script', {
    script,
    scriptType,
    method: context?.method,
    url: context?.url,
    headers: context?.headers,
    body: context?.body,
    responseStatus: context?.responseStatus,
    responseBody: context?.responseBody,
    responseHeaders: context?.responseHeaders,
    responseTime: context?.responseTime,
  });
}

// Collection Runner
export async function runCollection(
  collectionId: string,
  options?: { iterations?: number; delayMs?: number }
): Promise<unknown> {
  return invoke('run_collection', {
    collectionId,
    options: options ? { iterations: options.iterations, delay_ms: options.delayMs } : null,
  });
}

export async function cancelRunner(): Promise<void> {
  return invoke('cancel_runner');
}

// Collections
export async function getCollections(): Promise<Collection[]> {
  return invoke('get_collections');
}

export async function createCollection(name: string, description?: string): Promise<Collection> {
  return invoke('create_collection', { name, description: description ?? '' });
}

export async function updateCollection(id: string, name: string, description: string): Promise<void> {
  return invoke('update_collection', { id, name, description });
}

export async function deleteCollection(id: string): Promise<void> {
  return invoke('delete_collection', { id });
}

export async function moveCollection(id: string, newParentId: string | null): Promise<void> {
  return invoke('move_collection', { id, newParentId });
}

// Requests (saved requests in collections)
export async function getRequests(collectionId: string): Promise<RequestData[]> {
  return invoke('get_requests', { collectionId });
}

export async function getRequest(id: string): Promise<RequestData> {
  return invoke('get_request', { id });
}

export async function createSavedRequest(request: RequestData): Promise<void> {
  return invoke('create_request', {
    request: {
      id: request.id,
      collectionId: request.collectionId,
      name: request.name,
      method: request.method,
      url: request.url,
      params: request.params,
      headers: request.headers,
      body: request.body,
      auth: request.auth,
      preRequestScript: request.preRequestScript,
      testScript: request.testScript,
      sortOrder: request.sortOrder,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
  });
}

export async function updateSavedRequest(request: RequestData): Promise<void> {
  return invoke('update_request', {
    request: {
      id: request.id,
      collectionId: request.collectionId,
      name: request.name,
      method: request.method,
      url: request.url,
      params: request.params,
      headers: request.headers,
      body: request.body,
      auth: request.auth,
      preRequestScript: request.preRequestScript,
      testScript: request.testScript,
      sortOrder: request.sortOrder,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
  });
}

export async function deleteSavedRequest(id: string): Promise<void> {
  return invoke('delete_request', { id });
}

export async function moveRequest(id: string, newCollectionId: string, sortOrder: number): Promise<void> {
  return invoke('move_request', { id, newCollectionId, sortOrder });
}

export async function reorderRequest(id: string, sortOrder: number): Promise<void> {
  return invoke('reorder_request', { id, sortOrder });
}

// Environments
export async function getEnvironments(): Promise<Environment[]> {
  return invoke('get_environments');
}

export async function createEnvironment(name: string, variables: unknown): Promise<Environment> {
  return invoke('create_environment', { name, variables });
}

export async function updateEnvironment(id: string, name: string, variables: unknown): Promise<void> {
  return invoke('update_environment', { id, name, variables });
}

export async function deleteEnvironment(id: string): Promise<void> {
  return invoke('delete_environment', { id });
}

export async function setActiveEnvironment(id: string): Promise<void> {
  return invoke('set_active_environment', { id });
}

// History
export async function getHistory(limit?: number, offset?: number) {
  return invoke('get_history', { limit: limit ?? 100, offset: offset ?? 0 });
}

export async function clearHistory(): Promise<void> {
  return invoke('clear_history');
}

// Import / Export
export async function importPostmanCollection(jsonContent: string): Promise<Collection> {
  return invoke('import_postman_collection', { jsonContent });
}

export async function exportPostmanCollection(collectionId: string): Promise<string> {
  return invoke('export_postman_collection', { collectionId });
}

// WebSocket
export async function wsConnect(id: string, url: string): Promise<void> {
  return invoke('ws_connect', { id, url });
}

export async function wsSend(id: string, message: string): Promise<void> {
  return invoke('ws_send', { id, message });
}

export async function wsDisconnect(id: string): Promise<void> {
  return invoke('ws_disconnect', { id });
}

export async function wsIsConnected(id: string): Promise<boolean> {
  return invoke('ws_is_connected', { id });
}

// gRPC
export interface ProtoField {
  name: string;
  field_type: string;
  number: number;
  is_repeated: boolean;
  is_map: boolean;
}

export interface ProtoMessage {
  full_name: string;
  fields: ProtoField[];
}

export interface ProtoMethod {
  name: string;
  full_name: string;
  input_type: string;
  output_type: string;
  client_streaming: boolean;
  server_streaming: boolean;
}

export interface ProtoService {
  name: string;
  full_name: string;
  methods: ProtoMethod[];
}

export interface ProtoDefinition {
  services: ProtoService[];
  messages: ProtoMessage[];
}

export interface GrpcResponse {
  body: string;
  messages: string[] | null;
  time: number;
  error: string | null;
}

export async function loadProto(protoContent: string): Promise<ProtoDefinition> {
  return invoke('load_proto', { protoContent });
}

export async function grpcUnaryCall(
  url: string,
  service: string,
  method: string,
  bodyJson: string,
  metadata: [string, string][],
): Promise<GrpcResponse> {
  return invoke('grpc_unary_call', { url, service, method, bodyJson, metadata });
}

export async function grpcServerStreamCall(
  url: string,
  service: string,
  method: string,
  bodyJson: string,
  metadata: [string, string][],
): Promise<GrpcResponse> {
  return invoke('grpc_server_stream_call', { url, service, method, bodyJson, metadata });
}

// Global Search
export interface SearchResult {
  result_type: string; // "collection" | "request" | "history"
  id: string;
  name: string;
  url: string | null;
  method: string | null;
  collection_name: string | null;
  collection_id: string | null;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  return invoke('global_search', { query });
}

// Settings
export async function getSettings(): Promise<string> {
  return invoke('get_settings');
}

export async function updateSettings(settingsJson: string): Promise<void> {
  return invoke('update_settings', { settingsJson });
}

// Code Generation
export async function generateCode(
  language: string,
  method: string,
  url: string,
  headers: [string, string][],
  body: string | null,
): Promise<string> {
  return invoke('generate_code', { language, method, url, headers, body });
}
