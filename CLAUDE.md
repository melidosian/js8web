# js8web — Agent Rules

This file gives a Claude agent full context to work on the js8web codebase without re-deriving things from scratch.

---

## What js8web is

js8web is a web-based monitor and control interface for **JS8Call** — an amateur radio digital communication application built on the FT8 protocol. It connects to a running JS8Call instance via its TCP API (default port 2442), captures all incoming events in real time, stores them in a local SQLite database, and serves a browser dashboard over HTTP.

The binary is self-contained: the entire `webapp/` directory is embedded at build time via Go's `//go:embed`.

---

## Architecture

```
JS8Call (TCP :2442) ←→ js8web (Go binary)
                              ├── SQLite DB (js8web.db)
                              ├── REST API  (:8080/api/*)
                              ├── WebSocket (:8080/ws/events)
                              └── Static files (embedded webapp/)
                                        ↑
                              Browser (Vue 3 via CDN, no bundler)
```

**Key flows:**
1. `js8call.go` maintains a persistent TCP connection with auto-reconnect. On every successful connect it sends `INBOX.GET_MESSAGES`, `RIG.GET_FREQ`, and `MODE.GET_SPEED` to seed initial state.
2. Incoming JSON events are dispatched by type in `dispatcher.go` to notifier functions.
3. Notifiers produce either a `DbObj` (persisted to SQLite + broadcast) or a `WebsocketEvent` (broadcast only).
4. `mainDispatcher` in `main.go` saves `DbObj`s and fans all events to connected WebSocket sessions.
5. The browser receives events via WebSocket, fires a `CustomEvent` on `window`, and Vue components listen for it.

---

## Build & Run

```bash
# Prerequisites: Go 1.25+ (pure-Go SQLite driver, no CGo/GCC needed)
go build -o js8web .

# Run (JS8Call must be running with TCP API on port 2442)
./js8web

# Run in background (log to file)
nohup ./js8web > js8web.log 2>&1 &
```

**All CLI flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `-port` | `8080` | HTTP listen port |
| `-js8call-addr` | `localhost:2442` | JS8Call TCP API address |
| `-db` | `./js8web.db` | SQLite database path |
| `-reconnect-interval` | `5` | Seconds between reconnect attempts |
| `-log-level` | `info` | Log level: debug/info/warn/error |

The HTTP server binds to `0.0.0.0:<port>` (all interfaces) — accessible on the local network without any extra flag.

**After any change to `webapp/` files, rebuild the binary** — the frontend is embedded at compile time, not served from disk.

Default login: **admin / admin**

---

## Source File Reference

### Go backend (root package `main`)

| File | Responsibility |
|------|---------------|
| `main.go` | Entry point; initialises logger, DB, channels, JS8Call connection, dispatcher, WebSocket container, HTTP server. `mainDispatcher` goroutine saves DbObjs and broadcasts all events. |
| `const.go` | CLI flag parsing, environment variable fallbacks, config globals. |
| `db.go` | SQLite connection setup. `initDb()` runs `res/initDb.sql` on first run. `runMigrations()` runs idempotent ALTER TABLE / CREATE TABLE IF NOT EXISTS statements on every start. |
| `dispatcher.go` | Routes each incoming JS8Call event type to its notifier function. Also fixes the ambiguous `STATION.STATUS` / `RIG.STATUS` naming collision. |
| `js8call.go` | Persistent TCP connection with auto-reconnect. `sendConnectEvents()` writes `INBOX.GET_MESSAGES`, `RIG.GET_FREQ`, `MODE.GET_SPEED`, etc. directly to the bufio.Writer immediately after each successful connect (before the event loop). `retryUnansweredRigStatus()` re-sends `RIG.GET_FREQ`/`MODE.GET_SPEED` if JS8Call didn't answer the first time — see Known Gotchas. |
| `api.go` | REST handlers: station info, rig status, rx-packets, chat-messages, tx-message. |
| `inboxApi.go` | REST handlers: `GET /api/inbox`, `POST /api/inbox`, `POST /api/rig/freq`, `POST /api/rig/speed`. |
| `auth.go` | Cookie-based session management, `authRequired`/`roleRequired`/`methodRoleRequired` middleware, login/logout/check handlers. |
| `userApi.go` | Admin-only user CRUD. |
| `webappServer.go` | `http.NewServeMux` setup; registers all routes; serves embedded `webapp/`. |
| `websocket.go` | WebSocket upgrade handler, session container, broadcast. |
| `rxActivity.go` | Notifier for `RX.ACTIVITY`, `RX.DIRECTED`, `RX.DIRECTED.ME`, `RX.SPOT`. |
| `rigStatus.go` | Notifier for `RIG.STATUS` (updates `rigStatusCache`, broadcasts on change), `RIG.PTT`, `RIG.FREQ`, `MODE.SPEED`. |
| `stationInfo.go` | Notifier for `STATION.*` events; in-memory cache + DB persistence. |
| `txActivity.go` | Notifier for `TX.FRAME`; attaches pending TX text via `popPendingTxText()`. |
| `inboxActivity.go` | Notifiers for `INBOX.MESSAGES` (bulk) and `INBOX.MESSAGE` (single). |
| `pendingTx.go` | Mutex-protected FIFO queue (`setPendingTxText`/`advancePendingTxText`/`popPendingTxText`) for correlating outgoing message text with the arriving TX.FRAME event, in send order. |
| `callActivity.go` | Notifier for `RX.CALL_ACTIVITY`; in-memory `callActivityCache` (whole-snapshot replace, not diffed). |
| `bandActivity.go` | Notifier for `RX.BAND_ACTIVITY`; in-memory `bandActivityCache` (whole-snapshot replace, not diffed). |

### Model package (`model/`)

| File | Responsibility |
|------|---------------|
| `js8callEvent.go` | `Js8callEvent` struct with custom `UnmarshalJSON` (routes `params` into `Params`, or into `CallActivity`/`BandActivity` for the two dict-shaped event types), all event type constants, `InboxMessageParam`, `CalcChannelFromOffset`, `SpeedName`. |
| `callActivity.go` | `CallActivityWsEvent` (`map[string]CallActivityEntry`, keyed by callsign), `CallActivityEntry` (Grid/Snr/UTC). |
| `bandActivity.go` | `BandActivityWsEvent` (`map[string]BandActivityEntry`, keyed by offset), `BandActivityEntry` (Dial/Freq/Offset/Snr/Text/UTC). |
| `rxPacket.go` | `RxPacketObj`, `RxPacketFilter`, SQL, fetch/scan logic with callsign + frequency filtering. |
| `rxSpot.go` | `RxSpotObj`; `FetchRecentRxSpots` returns the 200 most recent, newest first. `RX.SPOT` has no timestamp field at all, so `CreateRxSpotObj` stamps `time.Now()` instead. |
| `txFrame.go` | `TxFrameObj` with `Text` field (for displaying transmitted message text). |
| `chatMessage.go` | `ChatMessage` unified wrapper; `FetchChatMessages` merges RX packets + TX frames sorted by timestamp. |
| `inboxMessage.go` | `InboxMessageObj`; `INSERT OR IGNORE` with UNIQUE(CALLSIGN, UTC_MS, MESSAGE) for dedup; `FetchInboxMessages`. |
| `rigStatus.go` | `RigStatusWsEvent` (in-memory rig state: Dial, Freq, Offset, Channel, Speed, Selected). |
| `stationInfo.go` | `StationInfoObj`/`StationInfoWsEvent`. |
| `user.go` | User model, SHA-256 hashing, role constants. |
| `utils.go` | `fromJs8Timestamp`, `toSqlTime`, `fromSqlTime`. |

### Database schema (`res/initDb.sql`)

| Table | Key columns |
|-------|-------------|
| `USERS` | ID, NAME, PASSWORD (SHA-256), ROLE, BIO |
| `RX_PACKET` | TIMESTAMP, TYPE, CHANNEL, DIAL, FREQ, OFFSET, SNR, MODE, SPEED, TIME_DRIFT, GRID, FROM, TO, TEXT, COMMAND, EXTRA |
| `RX_SPOT` | TIMESTAMP, CALL, GRID, SNR, CHANNEL, DIAL, FREQ, OFFSET |
| `TX_FRAME` | TIMESTAMP, CHANNEL, DIAL, FREQ, OFFSET, MODE, SPEED, SELECTED, TONES, **TEXT** |
| `STATION_INFO` | TIMESTAMP, LATEST (flag), CALL, GRID, INFO, STATUS |
| `INBOX_MESSAGE` | TIMESTAMP, CALLSIGN, MESSAGE, UTC_MS; UNIQUE(CALLSIGN, UTC_MS, MESSAGE) |

### Frontend (`webapp/`)

| File | Responsibility |
|------|---------------|
| `index.html` | SPA shell; loads Bootstrap 5, Vue 3 (CDN), axios (CDN) via import map. |
| `app.mjs` | Root Vue component. Auth state, initial data fetch, WebSocket with auto-reconnect (3 s), dispatches `CustomEvent` for child components. |
| `login-page.mjs` | Login form. |
| `status-bar.mjs` | Top bar: connection icon, callsign, grid, freq, offset, speed, selected, info, user+logout. |
| `toast-container.mjs` | Success/error/info/warning toast system. |
| `chat-window.mjs` | Tab manager. Owns `quickReplies` state (localStorage). Renders Chat, Inbox, Rig, Calls, Band, Settings, Admin tabs. |
| `chat.mjs` | Core message list with infinite scroll, real-time WS updates, compose input, quick-reply bar, `@callsign` prepend for filtered tabs. |
| `chat-message.mjs` | Router: renders `ChatRxPacket`, `ChatRxMessage`, or `ChatTxFrame` based on `message.Type`. |
| `chat-rx-message.mjs` | Directed message bubble: callsign + search icon, gauges, message text. |
| `chat-rx-packet.mjs` | Raw activity packet. |
| `chat-tx-frame.mjs` | Transmitted frame: shows actual message text (`message.Text`), clickable frequency button. |
| `chat-rx-header-icons.mjs` | Reusable gauge icons: frequency (clickable → freq tab), SNR, speed, drift. |
| `quick-replies.mjs` | Shared helpers: defaults (CQ/INFO/HOW CPY/QSL/73), `loadQuickReplies`/`saveQuickReplies` (localStorage key: `quickReplies`), `textColorForBg` (YIQ luminance). |
| `quick-reply-bar.mjs` | Horizontal button bar above compose input; `flex-wrap` for mobile. |
| `quick-reply-settings.mjs` | Settings section: add/edit (label+color+message)/reorder/delete; live color preview. |
| `inbox.mjs` | Inbox tab: compose form (callsign + message), scrollable message list, real-time WS updates. |
| `inbox-message.mjs` | Single inbox message: callsign, timestamp, message body. |
| `rig.mjs` | Rig control tab: live freq display, preset buttons (80/40/30/20/15m), offset slider (200-3000Hz), speed buttons (Slow/Normal/Fast/Turbo). |
| `admin-users.mjs` | Admin panel: list/create/edit/delete users. |
| `snr-color.mjs` | Shared `snrColor(snr)` gradient helper (blue→yellow→red), used by chat gauges and the activity tabs. |
| `call-activity.mjs` | Calls tab: table of heard callsigns (grid, SNR, last heard) from JS8Call's call activity window; click a callsign to open a filtered chat tab. |
| `band-activity.mjs` | Band tab: table of current band activity by offset (SNR, text, last heard); click an offset to open a frequency-filtered chat tab. |
| `grid-to-latlon.mjs` | Converts a Maidenhead grid locator (4 or 6 chars) to the approximate lat/lon of its center. Pure function. |
| `spots.mjs` | Spots tab: Leaflet map (one marker per callsign, most recent spot, SNR color-coded via `snr-color.mjs`) + list of the 200 most recent spots. Leaflet is loaded via the `leaflet` import map entry in `index.html` (named exports only — `import { map, tileLayer, circleMarker, layerGroup } from 'leaflet'`, no `L` namespace object). |
| `style.css` | All CSS: status bar, chat layout, message bubbles, gauges, quick-reply bar, inbox, rig panel, activity tables, spots map/list, mobile responsive. |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/station-info` | none | Current station info from cache |
| GET | `/api/rig-status` | none | Current rig status from cache |
| GET | `/api/call-activity` | none | Current call activity snapshot from cache (keyed by callsign) |
| GET | `/api/band-activity` | none | Current band activity snapshot from cache (keyed by offset) |
| GET | `/api/rx-spots` | none | 200 most recent station spots, newest first |
| GET | `/api/rx-packets` | none | Paginated RX packets with filter |
| GET | `/api/chat-messages` | none | RX packets + TX frames merged, paginated |
| POST | `/api/tx-message` | operator+ | Send message to JS8Call |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/logout` | session | Logout |
| GET | `/api/auth/check` | — | Check session |
| GET | `/api/inbox` | auth | All inbox messages, newest first |
| POST | `/api/inbox` | operator+ | Store message in JS8Call inbox |
| POST | `/api/rig/freq` | operator+ | Set rig dial frequency |
| POST | `/api/rig/speed` | operator+ | Set TX speed mode |
| GET | `/api/users` | admin | List users |
| POST | `/api/users` | admin | Create user |
| GET | `/api/users/{id}` | admin | Get user |
| PUT | `/api/users/{id}` | admin | Update user role/bio |
| DELETE | `/api/users/{id}` | admin | Delete user |
| PUT | `/api/users/{id}/password` | admin | Change password |
| GET | `/ws/events` | — | WebSocket event stream |

**Filter parameter format** (for `/api/chat-messages` and `/api/rx-packets`):
```
?filter={"Callsign":"W1AW"}                            # callsign filter
?filter={"Freq":{"From":7079000,"To":7079050}}         # freq slot filter
```
The filter **must be JSON-stringified** before sending as a query param — axios does not do this automatically for object params (it uses bracket notation instead). Call `JSON.stringify(filter)` in the frontend.

---

## JS8Call Event Types

### Incoming (JS8Call → js8web)

| Event | Handler | Notes |
|-------|---------|-------|
| `RX.ACTIVITY` | `rxActivityNotifier` | Raw decoded packet |
| `RX.DIRECTED` | `rxActivityNotifier` | Directed message |
| `RX.DIRECTED.ME` | `rxActivityNotifier` | Message to own station |
| `RX.SPOT` | `rxSpotNotifier` | Station spot report |
| `TX.FRAME` | `txFrameNotifier` | Audio frame (no text); text correlated from `pendingTxText` |
| `STATION.STATUS` | `rigStatusNotifier` or `stationInfoNotifier` | Dispatcher renames to `RIG.STATUS` when `params.Freq > 0` |
| `RIG.STATUS` | `rigStatusNotifier` | Freq/offset/speed/selected |
| `RIG.FREQ` | `rigFreqNotifier` | Updates `rigStatusCache`, broadcasts |
| `RIG.PTT` | `rigPttNotifier` | PTT on/off |
| `MODE.SPEED` | `modeSpeedNotifier` | Updates `rigStatusCache.Speed`, broadcasts |
| `INBOX.MESSAGES` | `inboxMessagesNotifier` | Bulk inbox; `event.Params.Messages []InboxMessageParam` |
| `INBOX.MESSAGE` | `inboxMessageNotifier` | Single new inbox message |
| `STATION.CALLSIGN` / `STATION.GRID` / `STATION.INFO` | `stationInfoNotifier` | Station metadata |
| `RX.CALL_ACTIVITY` | `callActivityNotifier` | Full call activity window snapshot, `params` is a dict keyed by callsign — decoded into `event.CallActivity`, not `event.Params` |
| `RX.BAND_ACTIVITY` | `bandActivityNotifier` | Full band activity window snapshot, `params` is a dict keyed by offset — decoded into `event.BandActivity`, not `event.Params` |

### Outgoing (js8web → JS8Call)

| Event | Sent when |
|-------|-----------|
| `TX.SEND_MESSAGE` | User posts to `/api/tx-message` |
| `INBOX.GET_MESSAGES` | On every TCP connect (via `sendConnectEvents`) |
| `INBOX.STORE_MESSAGE` | User posts to `/api/inbox` |
| `RIG.GET_FREQ` | On every TCP connect |
| `RIG.SET_FREQ` | User posts to `/api/rig/freq` |
| `MODE.GET_SPEED` | On every TCP connect |
| `MODE.SET_SPEED` | User posts to `/api/rig/speed` |
| `RX.GET_CALL_ACTIVITY` | On every TCP connect |
| `RX.GET_BAND_ACTIVITY` | On every TCP connect |

---

## Known Gotchas

### TX.FRAME has no message text
JS8Call's `TX.FRAME` event contains only tone data (TONES array), not the message text. The text is captured in `pendingTx.go` when the outgoing `TX.SEND_MESSAGE` is queued (`setPendingTxText`, appended to a FIFO queue — sends can be queued faster than JS8Call transmits them). `rigPttNotifier` (`rigStatus.go`) calls `advancePendingTxText()` on the PTT-on edge (false→true), dequeuing the next queued text into the slot `txFrameNotifier` reads via `popPendingTxText()` on the first `TX.FRAME` of that transmission. Subsequent frames for the same transmission get an empty text and display "Transmitted frame" as a fallback. This relies on JS8Call emitting `RIG.PTT(true)` before the first `TX.FRAME` of each transmission — true for the protocol's single-threaded dispatch, but only exercised via passive review, not a live over-the-air test.

### INBOX.GET_MESSAGES on every reconnect
`sendConnectEvents` sends `INBOX.GET_MESSAGES` every time the TCP connection is established (including reconnects). JS8Call responds with `INBOX.MESSAGES` containing all stored messages. The `INSERT OR IGNORE` in `InboxMessageObj.Insert` with a `UNIQUE(CALLSIGN, UTC_MS, MESSAGE)` constraint prevents duplicate DB rows. The frontend deduplicates by `Id` in the WebSocket handler.

### RIG.GET_FREQ / MODE.GET_SPEED are not answered reliably on connect
Observed directly: on a fresh connect, JS8Call reliably answers `INBOX.GET_MESSAGES`, but sometimes silently ignores `RIG.GET_FREQ` / `MODE.GET_SPEED` / the `STATION.GET_*` requests sent alongside it in `sendConnectEvents` — no error, just no reply, leaving `rigStatusCache` blank (`Dial:0`, `Speed:""`) until something else populates it. Also observed: JS8Call's TCP server has a connection limit and returns `{"type":"API.ERROR","value":"Connections Full"}` for new connections once it's hit — heavy reconnect churn (e.g. repeatedly restarting js8web against a live JS8Call during dev) can leave stale connections that make this worse. `retryUnansweredRigStatus` (`js8call.go`) re-sends `RIG.GET_FREQ`/`MODE.GET_SPEED` every 4s (up to 5 times) until `rigStatusCache` is populated, which reliably recovers it in practice. If you see blank rig status that never resolves even after the retries exhaust, suspect JS8Call's own connection pool being clogged and restart JS8Call itself.

### JS8Call echoes your own SET commands back under their own type name
`RIG.SET_FREQ` and `MODE.SET_SPEED` (and likely other `*.SET_*` commands) get echoed back to the sender by JS8Call's TCP server under the same command type you sent — not translated into the corresponding status-broadcast type (`RIG.FREQ`, `MODE.SPEED`). The dispatcher routes both the SET-echo and the broadcast type to the same notifier for frequency and speed (`case model.EVENT_TYPE_RIG_FREQ, model.EVENT_TYPE_RIG_SET_FREQ: f = rigFreqNotifier`, similarly for speed) since the echoed params carry identical fields. If you add a new outgoing `SET_`/`STORE_` command, check whether its echo needs the same treatment — an unhandled echo silently falls through to `defaultNotifier` (debug-only log), which reads as "nothing happened" even though the command succeeded.

### RX.CALL_ACTIVITY / RX.BAND_ACTIVITY have dict-shaped params, not the usual fixed shape
Every other JS8Call event's `params` is a flat object with a fixed set of keys (DIAL, FREQ, SNR, etc.), matching `Js8callEventParams`. These two are different: `params` is a dict keyed by callsign (call activity) or offset (band activity), e.g. `{"K4EXA":{"GRID":"EM63","SNR":-18,"UTC":...}}`. `Js8callEvent.UnmarshalJSON` special-cases these two event types, decoding into `event.CallActivity`/`event.BandActivity` (both `json:"-"`, so they don't leak into normal marshal output) instead of `event.Params`, which stays zero-valued for these two types. If you add another event type with this same dict-shaped quirk, extend the switch in `UnmarshalJSON`, not `Js8callEventParams`. The `CallActivityEntry`/`BandActivityEntry` field tags are intentionally all-caps (`GRID`, `SNR`, `UTC`, ...) to match JS8Call's wire format directly, since the same struct is reused to serialize `/api/call-activity`/`/api/band-activity` and the websocket broadcast — the frontend reads `row.GRID`/`row.SNR` etc., not the PascalCase convention used by RX_PACKET/RIG_STATUS's hand-written model types.

### RX.SPOT has no timestamp field
Unlike `RX.ACTIVITY`/`RX.DIRECTED` (which carry `UTC`), `RX.SPOT`'s documented payload is `{"CALL":"...","DIAL":...,"FREQ":...,"GRID":"...","OFFSET":...,"SNR":...,"_ID":-1}` — no time reference at all (`_ID` is a fixed `-1` sentinel here, not usable as a timestamp). `CreateRxSpotObj` (`model/rxSpot.go`) stamps `time.Now().UTC()` at receive time instead of reading `event.Params.UTC` (which is always 0 for this event type — this was a real bug before it was fixed: every stored spot had timestamp `1970-01-01`).

### JS8Call speed codes
The integer codes for `MODE.SET_SPEED` and `model.SpeedName()` are:

| Code | Name |
|------|------|
| 0 | normal |
| 1 | fast |
| 2 | turbo |
| 4 | slow |
| 8 | ultra |

Do not use sequential codes 0–3 — JS8Call uses 4 for slow and 8 for ultra.

### STATION.STATUS / RIG.STATUS collision
JS8Call uses the same event type name `STATION.STATUS` for two different purposes. The dispatcher's `fixSameNameForDifferentStationStatusEvents` renames it to `RIG.STATUS` when `params.Freq > 0`. This is how rig frequency/speed updates arrive.

### Filter must be JSON-stringified
`axios.get('/api/chat-messages', { params: { filter: obj } })` serialises `obj` as `filter[Callsign]=W1AW` (bracket notation). The server expects `filter={"Callsign":"W1AW"}`. Always use `JSON.stringify(filter)` in the `params` object.

### Freq/Offset in TX frames come from rigStatusCache
`CreateTxFrameObj` only sets `Timestamp` and `Tones` from the event. All other fields (Dial, Freq, Offset, Speed, Selected) are applied by `ApplyRigStatus(&rigStatusCache)` immediately after. If JS8Call hasn't sent a RIG.STATUS yet, these will be zero.

### No bundler
The frontend uses Vue 3 and axios loaded directly from CDN via an import map in `index.html`. All component files are plain `.mjs` ES modules. There is no npm, no webpack, no Vite. After any frontend change, rebuild the Go binary to re-embed the files.

### Database migrations
`runMigrations()` in `db.go` runs on every startup and is idempotent. Add new migrations there. For `ALTER TABLE ADD COLUMN`, catch the "duplicate column name" error. For new tables, use `CREATE TABLE IF NOT EXISTS`.

---

## Coding Conventions

### Go
- Single `main` package; domain logic split by feature file (one notifier per event domain)
- Model types in `model/` sub-package; implement `DbObj` (= `Save(*sql.DB) error` + `WsType() string`) for persisted objects
- SQL queries are package-level `var` string constants; use prepared statements for all queries
- Notifier function signature: `func(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error`
- API handlers that need `outgoingEvents` are constructor functions returning a handler: `func apiXxx(outgoingEvents chan<-) func(w, r, db)`
- `authRequired` wraps `http.HandlerFunc`; `roleRequired(roles, next)` does the same with role check
- `methodHandler(methodRouter{get: ..., post: ...}, db)` returns an `http.HandlerFunc` that dispatches by HTTP method
- For a route where only some methods need a stricter role (e.g. `/api/inbox`: GET open to any authenticated user, POST operator/admin-only), wrap the whole route in `authRequired` and wrap just that method's `methodRouter` field in `methodRoleRequired(roles, handler)` — don't hand-roll a role check inside the handler

### Vue 3 / Frontend
- All components are plain `.mjs` ES modules with `export default { ... }`
- Templates are backtick template literal strings — no `${...}` JS interpolation inside (use Vue `{{ }}` and `:binding` syntax instead)
- No TypeScript, no JSX, no build step
- State that needs to be shared between sibling components goes in the nearest common parent (e.g., `quickReplies` in `chat-window.mjs`)
- `$root.rigStatus`, `$root.authenticated`, `$root.authUser` are accessible from any component
- WebSocket events arrive as `CustomEvent('event', { detail: wsMessage })` fired on `window`; listen with `window.addEventListener('event', handler)` and remove in `unmounted()`
- Quick-reply state is persisted to `localStorage` under key `quickReplies`

### CSS
- All styles in `webapp/style.css`
- Mobile responsive styles are in `@media (max-width: 768px)` blocks at the bottom
- Tab bar (`nav-tabs`) has `flex-shrink: 0` — it must never be compressed by the flex layout
- `.chat` is `flex: 1 1 0; min-height: 0; overflow: hidden` — this is what makes the chat fill available space correctly
- `.chat-history` is `flex: 1 1 0; min-height: 0; overflow-y: scroll` — NOT `height: 100%` (that caused the layout bug)

---

## Testing

There are no automated tests. Manual testing checklist:

1. `go build -o js8web .` — must compile without errors
2. `./js8web` starts and logs "js8web ready"
3. `curl http://localhost:8080/` returns HTTP 200
4. `curl http://localhost:8080/api/auth/check` returns `{"ok":false}`
5. Login at `http://localhost:8080` with admin/admin works
6. With JS8Call running and TCP API enabled: status bar populates, messages appear
7. Send a message → appears in chat with actual text (not "Transmitted frame")
8. Click a callsign's search icon → new tab opens and auto-activates, filtered to that callsign
9. Click same callsign again → activates existing tab, no duplicate
10. Click a frequency → frequency-filtered tab opens
11. Inbox tab loads (may be empty if JS8Call inbox is empty)
12. Rig tab shows current frequency; preset buttons are ≥44px on mobile

---

## Features Added (Session History)

These features were added after the initial codebase and are not in the original upstream:

| Feature | Files changed |
|---------|--------------|
| TX message text display | `model/txFrame.go`, `txActivity.go`, `api.go`, `pendingTx.go`, `db.go`, `res/initDb.sql`, `chat-tx-frame.mjs` |
| TX frequency clickable button | `chat-tx-frame.mjs`, `chat-message.mjs` |
| Callsign tab: auto-activate on open | `chat-window.mjs` |
| Callsign tab: deduplication | `chat-window.mjs` |
| Callsign tab: filter actually works | `chat.mjs` (JSON.stringify fix) |
| @CALLSIGN prepend in filtered tabs | `chat.mjs` |
| Quick-reply button bar | `quick-replies.mjs`, `quick-reply-bar.mjs`, `quick-reply-settings.mjs`, `chat.mjs`, `chat-window.mjs`, `style.css` |
| Mobile tab layout fix | `style.css` (flex-shrink, min-height, height:100% removal) |
| Mobile tab touch targets | `style.css` (min-height: 44px on nav-link) |
| Inbox tab | `model/inboxMessage.go`, `inboxActivity.go`, `inboxApi.go`, `js8call.go`, `webappServer.go`, `db.go`, `res/initDb.sql`, `inbox.mjs`, `inbox-message.mjs` |
| Rig Control tab | `rigStatus.go`, `inboxApi.go`, `webappServer.go`, `rig.mjs` |
| Station Details settings, hide-heartbeat filter | `stationApi.go`, `webappServer.go`, `station-details.mjs`, `chat-window.mjs`, `chat.mjs`, `style.css` |
| Pure-Go SQLite driver (drop CGo dependency) | `db.go`, `go.mod`, `go.sum` (switched `mattn/go-sqlite3` → `modernc.org/sqlite`) |
| Calls / Band activity tabs | `model/js8callEvent.go` (custom `UnmarshalJSON`), `model/callActivity.go`, `model/bandActivity.go`, `callActivity.go`, `bandActivity.go`, `dispatcher.go`, `js8call.go`, `api.go`, `webappServer.go`, `call-activity.mjs`, `band-activity.mjs`, `snr-color.mjs`, `chat-window.mjs`, `style.css` |
| Spots tab (map + list), fix RX.SPOT timestamp bug | `model/rxSpot.go`, `api.go`, `webappServer.go`, `spots.mjs`, `grid-to-latlon.mjs`, `chat-window.mjs`, `index.html` (Leaflet CDN), `style.css` |
| systemd unit file | `js8web.service` |
