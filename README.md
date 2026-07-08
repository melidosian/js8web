# js8web

Web-based monitor and control interface for [JS8Call](http://js8call.com/) — an amateur radio digital communication application.

js8web connects to a running JS8Call instance via its TCP API, captures received messages and station events in real time, stores them in a local SQLite database, and presents everything through a browser-accessible chat-style dashboard.

## Quick Start

```bash
# Build (requires Go 1.25+)
go build -o js8web .

# Run (JS8Call must be running with TCP API enabled on port 2442)
./js8web

# Open in browser
# http://localhost:8080
# Default login: admin / admin
```

## Features

- **Real-time chat** — received JS8Call messages displayed as they arrive via WebSocket
- **Filter tabs** — click any callsign's 🔍 icon or any frequency indicator to open a filtered tab; tabs auto-activate and deduplicate
- **@CALLSIGN compose** — when in a callsign-filtered tab, the compose input prepends `@CALLSIGN` automatically
- **Quick-reply buttons** — configurable one-tap reply buttons (CQ, INFO, HOW CPY, QSL, 73) with custom labels, colors, and message text; saved in browser localStorage; editable via Settings tab
- **TX message display** — transmitted messages show their actual text in the chat (not just "Transmitted frame")
- **Inbox tab** — view and send messages to JS8Call's built-in inbox; updates in real time
- **Rig Control tab** — set dial frequency (with 5 band presets: 80/40/30/20/15m), set TX speed mode (Slow/Normal/Fast/Turbo)
- **Color-coded signal indicators** — SNR (blue→yellow→red), speed mode, time drift
- **Infinite scroll** — paginated message history loading
- **Mobile-friendly** — responsive layout, 44px+ touch targets on the tab bar and rig control buttons
- **Authentication** — cookie-based sessions; Admin/Operator/Monitor roles
- **User management** — admin panel for creating, editing, and deleting user accounts
- **SQLite persistence** — all activity logged; survives restarts
- **Single binary** — embedded web interface; no runtime dependencies

## Documentation

- **[User Manual](USER_MANUAL.md)** — installation, configuration, and full usage guide
- **[Development Documentation](DEVELOPMENT.md)** — architecture, code reference, API docs
- **[CLAUDE.md](CLAUDE.md)** — agent rules and codebase guide (for AI-assisted development)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/station-info` | GET | Current station info (callsign, grid, info, status) |
| `/api/rig-status` | GET | Current rig status (dial, freq, offset, speed, selected) |
| `/api/chat-messages` | GET | Paginated RX packets + TX frames merged by timestamp |
| `/api/rx-packets` | GET | Paginated RX packets only |
| `/api/tx-message` | POST | Send message to JS8Call (operator/admin) |
| `/api/inbox` | GET | All inbox messages, newest first (auth required) |
| `/api/inbox` | POST | Store message in JS8Call inbox (operator/admin) |
| `/api/rig/freq` | POST | Set dial frequency in Hz (operator/admin) |
| `/api/rig/speed` | POST | Set TX speed mode (operator/admin) |
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/check` | GET | Check current session |
| `/api/users` | GET/POST | List / create users (admin) |
| `/api/users/{id}` | GET/PUT/DELETE | Get / update / delete user (admin) |
| `/api/users/{id}/password` | PUT | Change user password (admin) |
| `/ws/events` | WS | Real-time event stream |

## License

See [LICENSE](LICENSE) for details.
