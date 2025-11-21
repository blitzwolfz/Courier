pub const CREATE_COLLECTIONS: &str = "
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    parent_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE CASCADE
);";

pub const CREATE_REQUESTS: &str = "
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    collection_id TEXT,
    name TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    url TEXT NOT NULL DEFAULT '',
    headers TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '{\"type\":\"none\",\"content\":\"\"}',
    auth TEXT NOT NULL DEFAULT '{\"type\":\"none\"}',
    pre_request_script TEXT NOT NULL DEFAULT '',
    test_script TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);";

pub const CREATE_ENVIRONMENTS: &str = "
CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    variables TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 0
);";

pub const CREATE_HISTORY: &str = "
CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    request_snapshot TEXT NOT NULL DEFAULT '{}',
    response_snapshot TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);";

pub const CREATE_SEARCH_INDEXES: &str = "
CREATE INDEX IF NOT EXISTS idx_requests_name ON requests(name);
CREATE INDEX IF NOT EXISTS idx_requests_url ON requests(url);
CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);";

pub const CREATE_SETTINGS: &str = "
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}'
);";
