# Development Setup

Instructions for building and running Courier from source.

---

## Prerequisites

### Required

- **Node.js** >= 18
- **npm** >= 9
- **Rust** >= 1.93.0 (earlier versions will fail due to the `chrono` dependency chain requiring edition 2024)
- **Tauri v2 system dependencies** (platform-specific, see below)

### Platform-Specific Dependencies

**Windows**
- WebView2 (pre-installed on Windows 10 21H2+ and Windows 11)
- Visual Studio Build Tools with the "Desktop development with C++" workload
- No additional libraries needed -- rusqlite uses the `bundled` feature to compile SQLite from source

**macOS**
- Xcode Command Line Tools: `xcode-select --install`
- WebKit is included with macOS

**Linux (Ubuntu/Debian)**
```
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## Installation

1. Clone the repository:

```
git clone <repository-url>
cd courier
```

2. Install frontend dependencies:

```
npm install
```

Rust dependencies are fetched automatically by Cargo on first build.

3. Verify your Rust toolchain:

```
rustc --version
```

If below 1.93.0, update with:

```
rustup update stable
```

---

## Development

Start the development server with hot-reload:

```
npm run tauri dev
```

This runs Vite on port 1420 for the frontend and compiles/launches the Tauri backend. The first build will take several minutes while Rust dependencies compile. Subsequent builds are incremental and much faster.

### Frontend only

To run just the Vite dev server without the Tauri backend (useful for CSS/UI work):

```
npm run dev
```

Tauri IPC calls (`invoke`) will fail in this mode since there is no Rust backend.

### Type checking

```
npx tsc --noEmit
```

### Vite build (frontend only)

```
npx vite build
```

---

## Building for Production

### Release build

```
npm run tauri build
```

This produces platform-specific installers in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| Windows | `courier.exe`, `Courier_0.1.0_x64_en-US.msi`, `Courier_0.1.0_x64-setup.exe` |
| macOS | `Courier.app`, `Courier_0.1.0_aarch64.dmg` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

### Debug build

```
npm run tauri build -- --debug
```

Includes debug symbols and developer tools access in the webview.

---

## Project Structure

```
courier/
  src/                              # Frontend (React 19 + TypeScript)
    components/
      common/                       # Button, Input, Select, Tabs, Badge, IconButton, KeyValueEditor, CodeEditor
      layout/                       # TopBar, Sidebar
      request/                      # RequestPanel, UrlBar, BodyEditor, AuthEditor, GraphQLEditor, ScriptEditor
      response/                     # ResponsePanel, CookiesViewer
      collections/                  # CollectionsTree (drag-and-drop, nested folders)
      environments/                 # EnvironmentsList
      websocket/                    # WebSocketPanel
      grpc/                         # GrpcPanel (proto loader, schema explorer)
      codegen/                      # CodeGenerator (11 languages)
      search/                       # GlobalSearch (command palette)
      settings/                     # SettingsModal
      runner/                       # CollectionRunner
    stores/
      slices/                       # Zustand slices (request, response, collections, environment, ui, history, settings)
      index.ts                      # Combined store
    styles/                         # variables.css, reset.css, global.css
    types/                          # TypeScript interfaces (request, response, collection, environment)
    utils/                          # api.ts (Tauri IPC wrappers), variables.ts (interpolation)
    hooks/                          # useKeyboardShortcuts
  src-tauri/                        # Backend (Rust)
    src/
      commands/                     # Tauri command handlers (request, collection, environment, history, codegen, websocket, scripting, runner, grpc, search, settings, import_export)
      db/                           # SQLite schema + CRUD (collections, requests, environments, history, settings)
      http/                         # reqwest HTTP client + digest auth
      grpc/                         # tonic gRPC client + protox proto parser
      codegen/                      # Code generation (11 languages)
      scripting/                    # boa_engine JS scripting engine
      websocket/                    # tokio-tungstenite WebSocket manager
      models/                       # Rust data models (Serialize/Deserialize)
      error.rs                      # AppError enum
      lib.rs                        # App entry point, command registration
```

---

## Data Storage

Courier stores its SQLite database (`courier.db`) in the platform-specific app data directory:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\com.courier.app\` |
| macOS | `~/Library/Application Support/com.courier.app/` |
| Linux | `~/.local/share/com.courier.app/` |

The database uses WAL (Write-Ahead Logging) mode for concurrent read performance. Tables: `collections`, `requests`, `environments`, `history`, `settings`.

---

## Configuration

### `src-tauri/tauri.conf.json`

- `productName`: Application display name
- `identifier`: Unique app identifier (`com.courier.app`)
- `app.windows[0]`: Window dimensions (1280x800 default, 900x600 minimum)
- `app.security.csp`: Content Security Policy (currently null for development)
- `bundle`: Installer targets and icon paths

### `src-tauri/capabilities/default.json`

Tauri permissions for the app. Currently enables:
- `core:default` -- standard Tauri APIs
- `opener:default` -- external link opening

---

## Key Dependencies

### Rust (src-tauri/Cargo.toml)

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.x | Desktop framework |
| reqwest | 0.12 | HTTP client |
| rusqlite | 0.31 | SQLite (bundled) |
| tokio | 1.x | Async runtime |
| boa_engine | 0.21 | JavaScript scripting engine |
| tonic | 0.12 | gRPC client |
| protox | 0.7 | Proto file parser |
| prost-reflect | 0.14 | Dynamic protobuf reflection |
| tokio-tungstenite | 0.24 | WebSocket client |
| chrono | 0.4 | Date/time |
| serde/serde_json | 1.x | Serialization |

### Frontend (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.x | UI framework |
| zustand | 5.x | State management (slices pattern) |
| @monaco-editor/react | 4.x | Code editor |
| react-resizable-panels | 4.x | Resizable panel layout |
| @dnd-kit/core | 6.x | Drag and drop |
| @dnd-kit/sortable | 10.x | Sortable lists |
| @tanstack/react-virtual | 3.x | Virtualized lists |
| lucide-react | 0.563 | Icons |
| vite | 6.x | Build tool |
| typescript | 5.9 | Type checking |

---

## Troubleshooting

**Rust compilation fails with "edition 2024" errors**
Your Rust toolchain is too old. Run `rustup update stable` to get >= 1.93.0.

**`npm run tauri dev` hangs on first run**
The initial Rust compilation can take 3-5 minutes. Check the terminal for Cargo output.

**WebView2 not found (Windows)**
Download the WebView2 Runtime from Microsoft: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

**SQLite linking errors**
The `rusqlite` crate uses the `bundled` feature, which compiles SQLite from C source. This requires a C compiler. On Windows, ensure Visual Studio Build Tools are installed. On Linux, ensure `build-essential` is installed.

**Port 1420 already in use**
Another process is using the Vite dev server port. Kill it or change the port in `vite.config.ts` and `src-tauri/tauri.conf.json` (`devUrl`).

**gRPC proto loading fails**
Ensure proto files use `syntax = "proto3";` and have valid import paths. Courier uses `protox` for parsing, which supports standard proto3 syntax.
