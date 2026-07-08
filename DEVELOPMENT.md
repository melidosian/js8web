# js8web — Development Documentation

## Project Overview

**js8web** is a web-based monitor and control interface for [JS8Call](http://js8call.com/), an amateur radio digital communication application built on top of the FT8 protocol. js8web connects to a running JS8Call instance via its TCP API, captures all incoming events (received packets, spots, rig status changes, etc.), persists them to a local SQLite database, and exposes them through a real-time web UI and REST/WebSocket API.

The goal is to provide a remote, browser-accessible dashboard for monitoring and eventually controlling a JS8Call station — useful for headless operation, multi-operator setups, and logging/archival.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Go 1.25 |
| Web framework | `net/http` standard library `ServeMux` |
| WebSocket | `gorilla/websocket` |
| Database | SQLite 3, pure Go (`modernc.org/sqlite` — no CGo/GCC required to build) |
| Logging | `go.uber.org/zap` |
| Frontend framework | Vue.js 3 (ESM via CDN, no build step) |
| CSS framework | Bootstrap 5.2 + Bootstrap Icons |
| HTTP client (frontend) | axios (CDN import map) |
| Static file serving | Go `embed` (webapp directory is embedded into the binary) |

---

## Architecture

```
┌─────────────┐       TCP JSON        ┌──────────────────────────────────────────┐
│   JS8Call    │ ◄──────────────────── │              js8web (Go binary)          │
│  Application │ ─────────────────────►│                                          │
└─────────────┘   localhost:2442       │  ┌──────────────────────────────────┐    │
                                       │  │  js8call.go                      │    │
                                       │  │  TCP client with auto-reconnect  │    │
                                       │  └────────┬───────────┬─────────────┘    │
                                       │           │ incoming  │ outgoing         │
                                       │           ▼           │                  │
                                       │  ┌────────────────┐   │                  │
                                       │  │ dispatcher.go   │   │                  │
                                       │  │ Event routing   │   │                  │
                                       │  └───┬────────┬───┘   │                  │
                                       │      │        │        │                  │
                                       │      ▼        ▼        │                  │
                                       │  ┌──────┐ ┌───────┐   │                  │
                                       │  │SQLite│ │  WS   │   │                  │
                                       │  │  DB  │ │Events │   │                  │
                                       │  └──────┘ └───┬───┘   │                  │
                                       │               │        │                  │
                                       │  ┌────────────▼────────▼─────────────┐   │
                                       │  │     webappServer.go               │   │
                                       │  │  HTTP server (:8080)              │   │
                                       │  │  ┌─────────┐ ┌──────┐ ┌───────┐  │   │
                                       │  │  │REST API  │ │  WS  │ │Static │  │   │
                                       │  │  │/api/*    │ │/ws/* │ │webapp │  │   │
                                       │  │  └─────────┘ └──────┘ └───────┘  │   │
                                       │  └──────────────────────────────────┘   │
                                       └──────────────────────────────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │  Browser (Vue3) │
                                               │  Chat-style UI  │
                                               └─────────────────┘
```

---

## Source File Reference

### Backend (Go, root package `main`)

| File | Responsibility |
|------|---------------|
| `main.go` | Entry point. Initializes logger, config, DB, channels, JS8Call connection, dispatcher, WebSocket session container, and HTTP server. Handles graceful shutdown via OS signals (SIGINT/SIGTERM). |
| `const.go` | Configuration: CLI flags, environment variable parsing, defaults. Embeds `res/initDb.sql` via `//go:embed`. Supports `-log-level` flag for configurable logging. |
| `js8call.go` | Manages the persistent TCP connection to JS8Call. Auto-reconnects on failure. Reads newline-delimited JSON events from JS8Call and writes outgoing events. `retryUnansweredRigStatus` re-sends `RIG.GET_FREQ`/`MODE.GET_SPEED` a few times if JS8Call didn't answer on connect (observed to happen in practice). |
| `dispatcher.go` | Central event router. Applies a fix for the ambiguous `STATION.STATUS` event. Dispatches each event type to its specific notifier function, producing `WebsocketEvent` or `DbObj` items. Also routes `RIG.SET_FREQ`/`MODE.SET_SPEED` (JS8Call's echo of its own SET commands) to the same notifiers as the corresponding broadcast type. |
| `rxActivity.go` | Notifier for `RX.ACTIVITY`, `RX.DIRECTED`, `RX.DIRECTED.ME` events → creates `RxPacketObj` for DB. Also handles `RX.SPOT` → creates `RxSpotObj`. |
| `rigStatus.go` | Notifier for `RIG.STATUS` (synthesized type) → updates in-memory `rigStatusCache` and emits WS event on change. Also handles `RIG.PTT` (advances the pending-TX-text queue on the PTT-on edge), `RIG.FREQ`, `MODE.SPEED`. |
| `stationInfo.go` | Notifier for `STATION.CALLSIGN`, `STATION.GRID`, `STATION.INFO`, `STATION.STATUS` → updates in-memory `stationInfoCache`, emits WS event and persists to DB. Initializes cache from last DB record on startup. |
| `stationApi.go` | REST handlers for `POST /api/station/grid`, `/info`, `/status` — sends `STATION.SET_*` to JS8Call. |
| `txActivity.go` | Notifier for `TX.FRAME` → creates `TxFrameObj`, applies current rig status and pending TX text, saves to DB. |
| `pendingTx.go` | Mutex-protected FIFO queue correlating outgoing message text (from `/api/tx-message`) with the `TX.FRAME` event it produces, in send order. |
| `inboxActivity.go` | Notifiers for `INBOX.MESSAGES` (bulk, on connect) and `INBOX.MESSAGE` (single, real-time). |
| `inboxApi.go` | REST handlers for `GET`/`POST /api/inbox`, `POST /api/rig/freq`, `POST /api/rig/speed`. |
| `callActivity.go` | Notifier for `RX.CALL_ACTIVITY` → in-memory `callActivityCache` (whole-snapshot replace). |
| `bandActivity.go` | Notifier for `RX.BAND_ACTIVITY` → in-memory `bandActivityCache` (whole-snapshot replace). |
| `db.go` | SQLite database initialization (`modernc.org/sqlite`, pure Go). Creates file and runs `initDb.sql` if DB does not exist. Creates default admin user. `runMigrations()` applies idempotent schema changes on every startup. |
| `webappServer.go` | HTTP server setup. Registers REST API routes (including auth and TX message endpoints), WebSocket endpoint, and static file handler for the embedded webapp. Implements method routing and auth middleware integration. |
| `api.go` | REST API handlers: station info, rig status, call/band activity, rx-packets, chat-messages, tx-message. |
| `auth.go` | Authentication system: cookie-based session management, login/logout/check API handlers, `authRequired`, `roleRequired`, and `methodRoleRequired` (per-method role check within a single route) middleware. Sessions are stored in-memory with 24-hour expiry. |
| `userApi.go` | User management API: list, create, update, delete users, change passwords. Admin-only endpoints. |
| `websocket.go` | WebSocket upgrade handler and session management. Each connected browser gets a session; all sessions receive broadcast messages. |
| `Dockerfile` | Multi-stage Docker build: Go 1.25 builder compiles the binary (no CGo needed), then copies it into a minimal `debian:bookworm-slim` runtime image. Exposes port 8080, uses `/data` volume for the database. |
| `.dockerignore` | Excludes build artifacts, database files, docs, and IDE files from Docker build context. |

### Model Package (`model/`)

| File | Responsibility |
|------|---------------|
| `js8callEvent.go` | Defines `Js8callEvent` and `Js8callEventParams` structs (JSON mapping of JS8Call TCP API). Custom `UnmarshalJSON` routes `params` into `Params` for most event types, or into `CallActivity`/`BandActivity` for the two whose `params` is a dict keyed by callsign/offset instead of the usual fixed shape. Declares all event type constants and WS type constants. `CalcChannelFromOffset`, `SpeedName` helpers. |
| `db.go` | Defines `DbObj` interface: objects that can be `Save()`d to DB and have a `WsType()`. |
| `websocketEvent.go` | Defines `WebsocketEvent` interface (anything with `WsType()`). |
| `websocketMessage.go` | Defines `WebsocketMessage` struct sent over WebSocket to browsers. |
| `rxPacket.go` | `RxPacketObj` — model for received packets. Insert, Scan, query logic. Supports filtered listing with pagination by timestamp (before/after). |
| `rxSpot.go` | `RxSpotObj` — model for RX spot reports. Insert logic. Stub for listing by days. |
| `txFrame.go` | `TxFrameObj` — model for transmitted frames, including `Text` (the actual transmitted message text, correlated via the pending-TX-text queue). Applies rig status before saving. Supports filtered listing with pagination by timestamp. |
| `rigStatus.go` | `RigStatusWsEvent` — in-memory rig status (dial freq, offset, speed, selected callsign). Not persisted. |
| `rigPtt.go` | `RigPttWsEvent` — PTT on/off event for WebSocket broadcast. |
| `stationInfo.go` | `StationInfoObj` / `StationInfoWsEvent` — station grid, info, status (callsign is read-only in JS8Call's API, not settable). Persisted with a "latest" flag pattern. |
| `inboxMessage.go` | `InboxMessageObj` — JS8Call inbox message model. `INSERT OR IGNORE` with `UNIQUE(CALLSIGN, UTC_MS, MESSAGE)` for dedup; detects the no-op via `RowsAffected()`, not `LastInsertId()` (SQLite doesn't reset the latter on a skipped insert). |
| `callActivity.go` | `CallActivityWsEvent` (`map[string]CallActivityEntry`, keyed by callsign) — JS8Call's call activity window snapshot. |
| `bandActivity.go` | `BandActivityWsEvent` (`map[string]BandActivityEntry`, keyed by offset) — JS8Call's band activity window snapshot. |
| `user.go` | `User` model with SHA-256 password hashing. Default admin/admin user. Roles: admin, monitor, operator. `FetchUserByName` and `FetchUserById` for lookups. `FetchAllUsers`, `UpdateUser`, `UpdateUserPassword`, `DeleteUser` for management. `UserPublic` for safe serialization. |
| `utils.go` | Time conversion helpers: JS8Call millisecond timestamps ↔ `time.Time` ↔ SQLite RFC3339 strings. |
| `chatMessage.go` | `ChatMessage` — unified wrapper for RX packets and TX frames. `FetchChatMessages` merges both types, sorted by timestamp, for the chat API. |

### Database Schema (`res/initDb.sql`)

| Table | Purpose |
|-------|---------|
| `USERS` | User accounts (name, password hash, role, bio) |
| `RX_PACKET` | Every received packet: timestamp, type, frequency info, SNR, speed, grid, from/to callsigns, text content, command/extra fields |
| `RX_SPOT` | Spot reports: call, grid, SNR, frequency info |
| `TX_FRAME` | Transmitted frames: frequency info, mode, speed, selected callsign, tone data, `TEXT` (actual transmitted message) |
| `STATION_INFO` | Station metadata snapshots: callsign, grid, info, status. Uses `LATEST=1` flag for current. |
| `INBOX_MESSAGE` | JS8Call inbox messages: timestamp, callsign, message, UTC ms. `UNIQUE(CALLSIGN, UTC_MS, MESSAGE)` for dedup. |

Call/band activity are in-memory only (whole-snapshot caches, not persisted) since JS8Call itself already treats them as live windows, not a log.

All timestamp-bearing tables have indexes on `TIMESTAMP`.

### Frontend (`webapp/`)

| File | Responsibility |
|------|---------------|
| `index.html` | Single-page app shell. Loads Bootstrap, Vue 3, axios via CDN. Mounts Vue app. |
| `app.mjs` | Root Vue component. Manages authentication state (login/logout). Fetches initial station info and rig status via REST API. Opens WebSocket with auto-reconnect logic (3s interval). Updates local state for station info, rig status, and PTT from WebSocket events. Dispatches events to child components via browser `CustomEvent`s. |
| `login-page.mjs` | Login form component. Submits credentials to `POST /api/auth/login`. Emits `login` event on success with username and role. |
| `toast-container.mjs` | Toast notification system. Displays success/error/warning/info messages with auto-dismiss (3s for success, 6s for errors). |
| `status-bar.mjs` | Status bar: connection indicator, dial frequency, offset, speed mode, selected callsign, logged-in user, logout button. (Station callsign/grid/info live under Settings > Station Details instead.) |
| `chat-window.mjs` | Tab manager. Default "All messages" tab + dynamic filter tabs (by callsign or frequency) + fixed Inbox/Rig/Calls/Band/Settings/Admin tabs. Owns quick-reply state (persisted to localStorage). |
| `chat.mjs` | Core chat/message list component. Infinite scroll (loads older/newer pages, auto-continues if a page is fully filtered out e.g. by the hide-heartbeat toggle). Listens for `RX.PACKET` and `TX.FRAME` WebSocket events and appends new messages in real-time. Uses `/api/chat-messages` for combined RX+TX history. Applies client-side filtering. Quick-reply button bar and message input (visible to operator and admin roles); `@CALLSIGN` auto-prepended when composing in a callsign-filtered tab. |
| `chat-message.mjs` | Router component: renders `ChatRxPacket` for raw `RX.ACTIVITY`, `ChatRxMessage` for `RX.DIRECTED`/`RX.DIRECTED.ME` messages, and `ChatTxFrame` for transmitted frames. |
| `chat-rx-message.mjs` | Renders a directed message with sender callsign, recipient, grid, timestamp, SNR/speed/drift gauges, and message text. Messages directed to own station are visually highlighted. |
| `chat-rx-packet.mjs` | Renders a raw activity packet with timestamp and gauges. |
| `chat-tx-frame.mjs` | Renders a transmitted frame: actual transmitted text, clickable frequency button, speed, selected callsign. |
| `chat-rx-header-icons.mjs` | Reusable gauge icons: frequency (clickable to filter), SNR (color-coded, via `snr-color.mjs`), speed indicator, time drift. |
| `snr-color.mjs` | Shared `snrColor(snr)` blue→yellow→red gradient helper, used by the chat gauges and the Calls/Band activity tables. |
| `quick-replies.mjs` | Shared quick-reply helpers: defaults, localStorage load/save, `textColorForBg` (YIQ luminance for button text contrast). |
| `quick-reply-bar.mjs` | Horizontal one-tap reply button bar above the compose input. |
| `quick-reply-settings.mjs` | Settings UI to add/edit/reorder/delete quick-reply buttons with live color preview. |
| `inbox.mjs` | Inbox tab: compose form (callsign + message), scrollable list of JS8Call's stored inbox messages, real-time updates. |
| `inbox-message.mjs` | Single inbox message: callsign, timestamp, message body. |
| `rig.mjs` | Rig Control tab: live frequency/speed display, band presets, offset slider (200-3000 Hz), TX speed buttons. Both frequency and offset inputs pre-fill from live rig status and stop auto-filling once the user touches a field, so adjusting one doesn't require re-entering the other. |
| `call-activity.mjs` | Calls tab: table of currently-heard callsigns (grid, SNR, last heard) from JS8Call's call activity window; click a callsign to open a filtered chat tab. |
| `band-activity.mjs` | Band tab: table of current band activity by offset (SNR, decoded text, last heard); click an offset to open a frequency-filtered chat tab. |
| `station-details.mjs` | Settings > Station Details: edit grid/info/status, saved directly to JS8Call. |
| `admin-users.mjs` | Admin panel for user management. List all users, create new users, change roles, reset passwords, delete users. Only accessible to admin role. |
| `style.css` | Chat-style layout. Flex-based full-height UI. Message bubbles, gauge styling, speed-color classes, activity tables, mobile-responsive media queries. |

---

## Data Flow

### Incoming (JS8Call → Browser)

1. **TCP Read** — `js8call.go` reads newline-delimited JSON from JS8Call TCP socket.
2. **Parse** — JSON is unmarshalled into `model.Js8callEvent`.
3. **Fix** — `dispatcher.go` renames ambiguous `STATION.STATUS` events that carry frequency info to `RIG.STATUS`.
4. **Dispatch** — Event is routed to the appropriate notifier based on type.
5. **Process** — Notifier creates either:
   - A `DbObj` (saved to SQLite, then broadcast to WS as `"object"` type), or
   - A `WebsocketEvent` (broadcast to WS as `"event"` type, not persisted), or both.
6. **Broadcast** — `mainDispatcher` sends `WebsocketMessage` to all connected WS sessions.
7. **Display** — Browser receives JSON via WebSocket, fires a `CustomEvent`, and Vue components update reactively.

### Outgoing (Browser → JS8Call)

1. **User input** — authenticated user types a message in the chat input field.
2. **API call** — `POST /api/tx-message` with `{"text": "..."}` body.
3. **Auth check** — `authRequired` middleware validates the session cookie.
4. **Queue** — handler creates a `Js8callEvent` with type `TX.SEND_MESSAGE` and sends it to the `outgoingEvents` channel.
5. **TCP Write** — `js8call.go` writes the JSON event to the JS8Call TCP socket.
6. **JS8Call** — JS8Call processes the message and queues it for transmission.

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/station-info` | GET | Returns current station info (grid, info, status) from in-memory cache. Callsign is not included — JS8Call's API exposes no way to set it, so it isn't editable/shown here. |
| `GET /api/rig-status` | GET | Returns current rig status (dial, freq, offset, channel, speed, selected) from in-memory cache. |
| `GET /api/call-activity` | GET | Returns the current call activity snapshot (map keyed by callsign) from in-memory cache. |
| `GET /api/band-activity` | GET | Returns the current band activity snapshot (map keyed by offset) from in-memory cache. |
| `GET /api/rx-packets` | GET | Returns up to 100 RX packets. Params: `startTime` (RFC3339), `direction` (`before`/`after`), optional `filter` (JSON with `Callsign` and/or `Freq.From`/`Freq.To`). |
| `GET /api/chat-messages` | GET | Returns up to 100 combined RX packets and TX frames, sorted by timestamp. Same params as `/api/rx-packets`. |
| `POST /api/tx-message` | POST | Sends a text message to JS8Call. Requires operator or admin role. Body: `{"text": "..."}`. |
| `GET /api/inbox` | GET | Returns all stored inbox messages, newest first. Requires authentication. |
| `POST /api/inbox` | POST | Stores a message in JS8Call's inbox. Requires operator or admin role. Body: `{"callsign": "...", "message": "..."}`. |
| `POST /api/rig/freq` | POST | Sets rig dial frequency and offset. Requires operator or admin role. Body: `{"dial": <Hz>, "offset": <Hz>}`. |
| `POST /api/rig/speed` | POST | Sets TX speed mode. Requires operator or admin role. Body: `{"speed": <code>}`. |
| `POST /api/station/grid` | POST | Sets station grid. Requires operator or admin role. Body: `{"value": "..."}`. |
| `POST /api/station/info` | POST | Sets station info/QTH text. Requires operator or admin role. Body: `{"value": "..."}`. |
| `POST /api/station/status` | POST | Sets station status message. Requires operator or admin role. Body: `{"value": "..."}`. |
| `POST /api/auth/login` | POST | Authenticates user. Body: `{"username": "...", "password": "..."}`. Returns session cookie. |
| `POST /api/auth/logout` | POST | Clears session cookie and invalidates server-side session. |
| `GET /api/auth/check` | GET | Checks if current session is valid. Returns `{"ok": true/false, "username": "...", "role": "..."}`. |
| `GET /api/users` | GET | Lists all users (admin only). Returns `{"ok": true, "users": [...]}`. |
| `POST /api/users` | POST | Creates a new user (admin only). Body: `{"username": "...", "password": "...", "role": "...", "bio": "..."}`. |
| `GET /api/users/{id}` | GET | Gets a single user (admin only). |
| `PUT /api/users/{id}` | PUT | Updates user role and bio (admin only). Body: `{"role": "...", "bio": "..."}`. |
| `DELETE /api/users/{id}` | DELETE | Deletes a user (admin only). Cannot delete yourself. |
| `PUT /api/users/{id}/password` | PUT | Changes a user's password (admin only). Body: `{"password": "..."}`. |

### WebSocket

| Endpoint | Direction | Description |
|----------|-----------|-------------|
| `ws://host:8080/ws/events` | Server → Client | Broadcasts all state changes. Message format: `{ EventType, WsType, Event }`. EventType is `"object"` (persisted) or `"event"` (transient). |

---

## Configuration

Configuration is handled via CLI flags and environment variables (defined in `const.go`).
CLI flags take precedence over environment variables, which take precedence over defaults.

| CLI Flag | Environment Variable | Default | Description |
|----------|---------------------|---------|-------------|
| `-js8call-addr` | `JS8WEB_JS8CALL_ADDR` | `localhost:2442` | JS8Call TCP API address |
| `-reconnect-interval` | `JS8WEB_RECONNECT_SEC` | `5` | Seconds between reconnection attempts |
| `-db` | `JS8WEB_DB_PATH` | `./js8web.db` | SQLite database file path |
| `-port` | `JS8WEB_PORT` | `8080` | HTTP server listen port |
| `-log-level` | `JS8WEB_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

Run `./js8web -help` to see all options.

---

## Build & Run

```bash
# Prerequisites: Go 1.25+ (pure-Go SQLite driver, no CGo/GCC needed)
go build -o js8web .
./js8web
```

The webapp is embedded in the binary — no separate deployment needed.

---

## Current Implementation Status

### ✅ Working

- TCP connection to JS8Call with auto-reconnect
- Parsing of all major JS8Call event types
- SQLite persistence for RX packets, RX spots, TX frames, station info
- In-memory caching of rig status and station info
- REST API for station info, rig status, and paginated RX packet listing with filters
- WebSocket broadcast of real-time events to all connected browsers
- Vue 3 SPA with chat-style message display
- **Status bar** showing dial frequency, offset, speed, selected callsign
- **Connection status indicator** (green wifi icon when connected, blinking red when disconnected)
- **WebSocket auto-reconnect** (3-second interval) with automatic data refresh on reconnect
- **PTT indicator** — red banner when transmitting
- **TX frame display** — transmitted frames shown in real-time in the chat
- **RX.DIRECTED.ME highlighting** — messages directed to own station visually distinguished (green background)
- Tab system with dynamic filter tabs (by callsign or frequency)
- Infinite scroll for message history
- Color-coded SNR, speed indicators, time drift gauges
- Raw packet toggle in settings
- Embedded static files (single binary deployment)
- **Configuration via CLI flags and environment variables** (`-port`, `-db`, `-js8call-addr`, `-reconnect-interval`)
- **Configurable log level** via `-log-level` flag / `JS8WEB_LOG_LEVEL` environment variable (debug/info/warn/error)
- **Graceful shutdown** via SIGINT/SIGTERM signals
- **Thread-safe WebSocket session management** with `sync.RWMutex`
- **Non-blocking WebSocket broadcast** (slow clients don't block others)
- Proper JSON `Content-Type` headers on all API responses
- Proper `<!DOCTYPE html>` and viewport meta for mobile support
- **Cookie-based authentication** — login/logout with session cookies, `authRequired` middleware, 24-hour session expiry
- **Send messages to JS8Call** from the web UI via `POST /api/tx-message` (requires authentication)
- **Login page** — dedicated login form shown to unauthenticated users
- **Toast notifications** — success/error feedback for user actions (message sent, login failures, etc.)
- **User display** — logged-in username shown in status bar with logout button
- **Role-based access control** — admin, operator, monitor roles enforced via `roleRequired` middleware. Monitors are read-only; operators can send messages; admins have full access including user management.
- **TX frame historical loading** — transmitted frames appear alongside RX packets when scrolling through message history via combined `/api/chat-messages` endpoint
- **User management** — admin panel with full CRUD: list users, create accounts, change roles, reset passwords, delete users (admin only)
- **Mobile-responsive layout** — CSS media queries for proper display on small screens (status bar wrapping, touch targets, scrollable tabs)
- **Docker container** — multi-stage Dockerfile for easy deployment; `/data` volume for persistent database
- **Pure-Go SQLite** (`modernc.org/sqlite`) — no CGo/GCC required to build
- **Quick-reply button bar** — configurable one-tap reply buttons (label/color/message), persisted to localStorage, editable in Settings
- **Inbox tab** — view JS8Call's stored inbox messages and store new ones, with real-time updates
- **Rig Control tab** — band presets, offset slider, TX speed buttons; both frequency and offset fields pre-fill from and stay in sync with live rig status
- **Calls tab** / **Band tab** — live tables of JS8Call's call/band activity windows, updating over the websocket
- **Station Details settings** — edit grid/info/status directly from js8web (callsign is read-only in JS8Call's API, so it's not editable here)
- **Hide-heartbeat filter** — hides incoming `HEARTBEAT` messages from chat, with infinite scroll adjusted so a fully-filtered page doesn't stall pagination

### 🚧 Partially Implemented / Stubbed

- **RX Spot listing** — `RxSpotListDays()` function body is empty (stub). Spots are stored but not displayed in the UI.

### ❌ Not Yet Implemented

- RX spot display / spot map
- HTTPS / TLS support
- Unit / integration tests
- CI/CD pipeline
- systemd service file

---

## Code Conventions

- **Go**: Standard Go project layout. Single `main` package with domain logic split by feature file. Model types in `model/` sub-package.
- **Frontend**: Vue 3 Composition-style components using `.mjs` ES modules loaded directly via browser import maps (no bundler). Component templates are inline template strings.
- **Database**: SQL queries are package-level `var` string constants. Prepared statements are used for all queries.
- **Naming**: JS8Call event types use dot notation (`RX.ACTIVITY`). Go structs use `Obj` suffix for DB-persisted models and `WsEvent` suffix for WebSocket-only events.
