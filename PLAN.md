# Courier -- Full Implementation Plan

> Postman-clone desktop app: Tauri v2 (Rust) + React 19 (TypeScript) + Mondrian/Bauhaus design

**Tech decisions:** CSS Modules, Zustand (slices), SQLite (rusqlite), Monaco Editor, react-resizable-panels, @dnd-kit

---

## Pre-Phase: Project Scaffolding -- COMPLETED

### 0.1 -- Initialize Tauri v2 project -- DONE
### 0.2 -- Install frontend dependencies -- DONE
### 0.3 -- Rust dependencies -- DONE
### 0.4 -- Directory structure skeleton -- DONE
### 0.5 -- Configure tauri.conf.json -- DONE
### 0.6 -- Verify scaffold compiles -- DONE

---

## Phase 1: Core Foundation -- COMPLETED

- Bauhaus Design System (CSS variables, reset, global styles)
- Base UI Components (Button, Input, Select, Tabs, KeyValueEditor, Badge, IconButton, CodeEditor)
- TypeScript Types (request, response, collection, environment)
- Zustand Store (7 slices: request, response, collections, environment, ui, history, settings)
- Rust Error Handling (AppError enum)
- Rust Data Models (HttpRequest, HttpResponse, Collection, Environment, HistoryEntry)
- Rust SQLite Layer (schema, CRUD for collections/requests/environments/settings)
- Rust HTTP Client (reqwest-based, elapsed timing)
- Rust Tauri Commands (send_request, collection/request/environment CRUD, history)
- Frontend API Layer (typed invoke wrappers)
- Layout (react-resizable-panels v4: horizontal sidebar + vertical request/response)
- TopBar, Sidebar, Collections Tree, Request Builder, Response Viewer
- Monaco Editor Integration (custom Bauhaus themes, no blue/purple tokens)
- Environment Management and Variable Interpolation

---

## Phase 2: Essential Features -- COMPLETED

- Request History (auto-capture, search, method filter, virtualized list)
- Tab System (horizontal scrollable, method badges, keyboard navigation)
- Scripting Engine (boa_engine v0.21, pre-request scripts, test assertions, console.log)
- Collection Runner (sequential execution, progress bar, pass/fail stats, cancellation)
- Postman Import/Export (v2.1 format, recursive folder parsing)
- Auth Methods (Bearer, Basic, API Key, OAuth 2.0, Digest MD5)
- Dark Mode (CSS variable overrides, Monaco theme switching)

---

## Phase 3: Advanced Protocols -- COMPLETED

- GraphQL Support (split query/variables editor, auto JSON payload)
- WebSocket Client (tokio-tungstenite, event-driven messages, connection management)
- Code Generation (11 languages: curl, JS fetch/axios, Python, Rust, Go, Java, C#, PHP, Ruby, Swift)
- Advanced Auth (OAuth 2.0 manual tokens, Digest challenge-response)
- Cookie Management (response cookie parsing, table display)

---

## Phase 4: Power Features -- COMPLETED

- gRPC Support (protox + prost-reflect + tonic, unary/streaming, schema explorer)
- Nested Collections + Drag-and-Drop (@dnd-kit, parent_id/sort_order)
- Keyboard Shortcuts (Ctrl+Enter, Ctrl+N/W/S/B/L/K/,, Ctrl+Shift+N, Ctrl+1-9)
- Global Search (command palette with SQL LIKE across collections/requests/URLs)
- Performance (virtualized lists, lazy Monaco, DB indexes, debounced search)

---

## Phase 5: Polish & Release -- COMPLETED

- Settings UI (modal with 5 sections, SQLite persistence)
- Dark Theme (done in Phase 2)
- Cross-Platform Packaging (Windows MSI/NSIS, macOS DMG, Linux deb/AppImage)
- Bug Fixes (large response truncation, request cancellation, error classification, retry)
- UI Redesign: Mondrian/Bauhaus "Control Deck" aesthetic
  - DM Sans + Space Mono typography
  - Palette: #E1000F red, #000000 black, #F5F0EB warm white, #FFD700 yellow
  - Zero border-radius, heavy structural borders (3-4px)
  - Red TopBar, black sidebar, massive 56px URL bar
  - Geometric scrollbars, color-coded zones
  - All 25 component CSS modules redesigned

---

## Build Notes

- **Rust**: 1.93.0, edition 2021
- **Frontend**: React 19, TypeScript 5.9, Vite 6.4, Zustand 5
- **Panels**: react-resizable-panels v4 (Group/Separator/orientation API)
- **Scripting**: boa_engine v0.21 (pure Rust JS engine)
- **gRPC**: tonic v0.12 + protox v0.7 + prost-reflect v0.14
- **DnD**: @dnd-kit/core v6 + @dnd-kit/sortable v10
- **Virtualization**: @tanstack/react-virtual v3
- **Design**: DM Sans + Space Mono, Mondrian aesthetic, zero border-radius
- **Build output**: courier.exe, Courier_0.1.0_x64_en-US.msi, Courier_0.1.0_x64-setup.exe
