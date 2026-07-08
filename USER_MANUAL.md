# js8web — User Manual

## What is js8web?

js8web is a web-based monitor and control interface for [JS8Call](http://js8call.com/), an amateur radio digital communication program. It runs alongside JS8Call and provides a browser-accessible dashboard showing received messages, station information, rig status, and inbox in real time. It also lets you transmit messages, control rig frequency and speed, and manage your JS8Call inbox from any device on your local network.

**Key features:**
- Real-time chat-style display of received JS8Call messages
- Filterable tabs by callsign or frequency, with auto-activate and deduplication
- Quick-reply button bar for one-tap common messages (fully configurable)
- Automatic `@CALLSIGN` prefixing when composing in a filtered tab
- Inbox tab for JS8Call's built-in message store
- Rig Control tab for tuning frequency (with offset slider) and TX speed
- Calls tab showing currently-heard callsigns (grid, SNR, last heard)
- Band tab showing current band activity by offset (SNR, decoded text, last heard)
- Station Details settings to edit grid/info/status from the Settings tab
- Hide-heartbeat filter to hide incoming HEARTBEAT messages
- TX messages show actual transmitted text in the chat
- Color-coded SNR, speed, and drift indicators
- Mobile-friendly layout with 44px+ touch targets
- Role-based access (Admin / Operator / Monitor)
- Single binary with embedded web interface

---

## Requirements

- **JS8Call** — installed, configured, and running with the TCP API enabled
- **Go 1.25+** — needed only for building from source
- A modern web browser (Chrome, Firefox, Edge, Safari)

---

## Installation

### Building from Source

```bash
git clone https://github.com/PiotrTopa/js8web.git
cd js8web
go build -o js8web .
```

This produces a single `js8web` executable with the web interface embedded inside.

### Running with Docker

```bash
# Build the image
git clone https://github.com/PiotrTopa/js8web.git
cd js8web
docker build -t js8web .

# Run
docker run -d \
  --name js8web \
  -p 8080:8080 \
  -v js8web-data:/data \
  js8web \
  -port 8080 \
  -js8call-addr <JS8CALL_HOST>:2442
```

Replace `<JS8CALL_HOST>` with the IP address of the machine running JS8Call. If JS8Call is on the same host, use the host's LAN IP (not `localhost` inside Docker). On Linux you can use `--network host` to bypass this.

Your database is stored in the `/data` volume and persists across container restarts.

---

## JS8Call Configuration

Before starting js8web, enable JS8Call's TCP API:

1. Open **JS8Call**
2. Go to **File → Settings → Reporting**
3. Check **Enable TCP Server API**
4. Confirm the **TCP Server Port** is `2442`
5. If js8web runs on a different machine, set the listening address to `0.0.0.0`

---

## Running js8web

```bash
./js8web -port 8080
```

On the first run, js8web will:
1. Create a SQLite database (`js8web.db`)
2. Set up the schema automatically
3. Create a default admin user (`admin` / `admin`)
4. Connect to JS8Call at `localhost:2442`
5. Start the web server on the specified port (binds to all interfaces, `0.0.0.0`)

Open your browser to `http://localhost:8080` (or `http://<your-ip>:8080` from another device).

### Command-Line Options

| Flag | Default | Description |
|------|---------|-------------|
| `-port` | `8080` | HTTP server port |
| `-js8call-addr` | `localhost:2442` | JS8Call TCP API address |
| `-db` | `./js8web.db` | SQLite database path |
| `-reconnect-interval` | `5` | Seconds between reconnect attempts |
| `-log-level` | `info` | Log level: debug / info / warn / error |

All flags can also be set via environment variables (`JS8WEB_PORT`, `JS8WEB_JS8CALL_ADDR`, `JS8WEB_DB_PATH`, `JS8WEB_RECONNECT_SEC`, `JS8WEB_LOG_LEVEL`). CLI flags take precedence.

### Running in the Background

```bash
nohup ./js8web -port 8080 > js8web.log 2>&1 &
```

---

## Login and Roles

When you open js8web you will see a login page. The default account is:

- **Username:** `admin`
- **Password:** `admin`

> ⚠️ Change the default password after first login using the Admin panel.

Sessions last 24 hours and are stored in a browser cookie. Logout is available via the button in the status bar.

### User Roles

| Role | Can view | Can send TX | Can use Inbox | Can use Rig Control | Can manage users |
|------|----------|-------------|---------------|---------------------|-----------------|
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Operator** | ✓ | ✓ | ✓ | ✓ | — |
| **Monitor** | ✓ | — | view only | view only | — |

---

## Interface Overview

### Status Bar

The dark bar at the top shows:

- **Connection indicator** — green wifi icon when connected, blinking red when disconnected
- **Dial** — current dial frequency in MHz
- **Offset** — audio offset in Hz
- **Speed** — JS8Call speed mode (color-coded: yellow=Normal, green=Fast, blue=Turbo, red=Slow)
- **Selected** — currently selected callsign in JS8Call
- **User** — your username and a logout button

Everything updates in real time as JS8Call reports changes. Your station's callsign, grid, and info text are shown/editable under Settings > Station Details instead of the status bar.

### PTT Indicator

When JS8Call is transmitting, a pulsing red **TX** banner appears below the status bar.

### Tab Bar

Tabs appear below the status bar. Fixed tabs:

- **All messages** — every received and transmitted message
- **Inbox** — JS8Call's built-in message inbox
- **Rig** — rig frequency and speed control
- **Calls** — currently-heard callsigns
- **Band** — current band activity by offset
- **⚙** — Settings (includes Station Details)
- **🛡 Admin** — user management (admin only)

Dynamic tabs are created by clicking callsign or frequency indicators. Each tab can be closed with ✕.

---

## Chat Tab

### Message Display

| Message type | Appearance |
|---|---|
| Directed message (`RX.DIRECTED`) | Chat bubble with callsign, recipient, grid, gauges, and text |
| Directed to you (`RX.DIRECTED.ME`) | Green background |
| Raw activity (`RX.ACTIVITY`) | Compact packet line (toggle in Settings) |
| Transmitted frame (`TX.FRAME`) | Red left border; shows actual message text sent |

Each message shows:
- **Frequency button** (clickable) — click to open a frequency-filtered tab
- **SNR gauge** — blue (weak) → yellow (moderate) → red (strong)
- **Speed indicator** — S/N/F/T/U
- **Time drift** in milliseconds

### Callsign and Frequency Tabs

- Click the **🔍 search icon** next to any callsign → opens a tab filtered to that callsign only; auto-activates and deduplicates (clicking the same callsign again activates the existing tab rather than creating a duplicate)
- Click any **frequency button** → opens a 50 Hz frequency slot tab
- Both tab types filter historical messages from the API and real-time incoming messages

### Composing Messages

When logged in as Operator or Admin:

1. Type your message in the input field at the bottom of the chat
2. Press **Enter** (or Shift+Enter for a newline) or click **Send**
3. The message is sent to JS8Call's TX queue
4. Once transmitted, it appears in the chat with the actual message text

**@CALLSIGN auto-prepend:** When in a callsign-filtered tab, the compose field shows a non-editable `@CALLSIGN` prefix. The prefix is automatically prepended to your message text at send time. Switch to the "All messages" tab to send without a prefix.

### Quick-Reply Buttons

A row of colored buttons above the compose input provides one-tap common messages:

| Default button | Default text |
|---|---|
| CQ | `CQ` |
| INFO | `INFO` |
| HOW CPY | `HOW CPY?` |
| QSL | `QSL` |
| 73 | `73` |

Clicking a button inserts its message text at the cursor position in the compose input (or appends to the end). Buttons wrap on small screens.

To customize quick-reply buttons, go to the **Settings** tab (gear icon) → **Quick Reply Buttons** section:

- **Add** — create a new button
- **Edit** — click any button preview to expand a form with Label, Color (color picker), and Message fields
- **Reorder** — use the ↑/↓ arrows
- **Delete** — trash icon
- **Reset defaults** — restore the original 5 buttons

Button configurations are saved to your browser's `localStorage` and persist across sessions. Button text color (black or white) is calculated automatically for readability based on the background color.

### Scrolling History

- Scroll up to load older messages
- Scroll down to load newer messages
- At the top: "(No more messages)"
- At the bottom: live receiving indicator; new messages append automatically

---

## Inbox Tab

The Inbox tab connects to JS8Call's built-in message inbox. Messages are fetched from JS8Call on every connection and updated in real time.

### Viewing Messages

The inbox shows all stored messages with:
- **Callsign** — the sender
- **Timestamp** — when the message was stored
- **Message text**

Messages are sorted newest first.

### Sending to Inbox

Operators and Admins can compose inbox messages:

1. Enter the recipient's **Callsign**
2. Type the **Message** text
3. Click **Send** or press Ctrl+Enter
4. The message is sent to JS8Call's `INBOX.STORE_MESSAGE` API

---

## Rig Control Tab

The Rig tab provides real-time frequency display and one-click frequency/speed control. All values update automatically when JS8Call reports changes.

### Frequency Control (Operator/Admin)

**Current frequency** is shown in MHz at the top of the section.

**Band presets** — one click sets the dial frequency to a common JS8Call frequency:

| Button | Frequency | Band |
|---|---|---|
| 3.578 | 3.578 MHz | 80m |
| 7.078 | 7.078 MHz | 40m |
| 10.130 | 10.130 MHz | 30m |
| 14.078 | 14.078 MHz | 20m |
| 21.078 | 21.078 MHz | 15m |

**Manual entry** — type a dial frequency in MHz, drag the offset slider (200-3000 Hz), then click **Set** or press Enter in the MHz field. Both fields pre-fill from the current rig status, so adjusting just one doesn't require re-entering the other; band presets only change the dial frequency and leave your current offset untouched.

### Speed Control (Operator/Admin)

Four buttons select the TX speed mode. The active mode is highlighted:

| Button | JS8Call mode |
|---|---|
| Slow | 4 |
| Normal | 0 (default) |
| Fast | 1 |
| Turbo | 2 |

Monitor users see a read-only note and cannot change the speed.

---

## Calls Tab

A live table of every callsign JS8Call has currently heard: grid square, color-coded SNR, and last-heard time. Click a callsign's 🔍 icon to open a chat tab filtered to that callsign, same as elsewhere in the app.

The table reflects JS8Call's own call activity window and updates over the websocket as JS8Call reports changes.

---

## Band Tab

A live table of current band activity by offset: SNR, the last decoded text at that offset, and last-heard time. Click an offset to open a frequency-filtered chat tab.

Reflects JS8Call's own band activity window; updates the same way as the Calls tab.

---

## Settings Tab

Click the **⚙** gear icon in the tab bar.

- **Show raw packets** — toggles display of `RX.ACTIVITY` raw packets alongside directed messages
- **Hide incoming heartbeat messages** — hides `HEARTBEAT` messages from the chat view
- **Station Details** — edit your grid square, station info (rig/antenna/location), and status message; saved directly to JS8Call. Your callsign isn't shown here since JS8Call's API doesn't expose a way to set it
- **Quick Reply Buttons** — configure custom quick-reply buttons (see [Quick-Reply Buttons](#quick-reply-buttons))

---

## Admin Tab

Visible to Admin users only (🛡 shield icon).

- **View all users** — username, role, bio
- **Create new users** — set username, password, role (admin/operator/monitor), optional bio
- **Change roles** — use the role dropdown
- **Reset passwords** — key icon
- **Delete users** — trash icon (you cannot delete your own account)

---

## Connection and Auto-Reconnect

js8web automatically reconnects to JS8Call on disconnect (configurable interval, default 5 seconds). On each successful connection it requests inbox messages, rig frequency/speed, station details, and call/band activity to refresh initial state. JS8Call doesn't always answer the frequency/speed requests on the first try, so js8web retries those a few times before giving up.

The browser WebSocket also auto-reconnects to the js8web server every 3 seconds if the connection drops.

---

## Database

All messages, spots, TX frames, inbox messages, and station info are stored in `js8web.db` (SQLite).

| Table | Contents |
|-------|----------|
| `RX_PACKET` | Received packets and directed messages |
| `RX_SPOT` | Station spot reports |
| `TX_FRAME` | Transmitted frames (with tone data and message text) |
| `STATION_INFO` | Station configuration snapshots |
| `INBOX_MESSAGE` | JS8Call inbox messages |
| `USERS` | User accounts |

**Backup:** Copy `js8web.db` while js8web is stopped.
**Reset:** Delete `js8web.db` and restart — a fresh database and default admin user will be created.

---

## Troubleshooting

### js8web cannot connect to JS8Call
- Ensure JS8Call is running and the TCP API is enabled (File → Settings → Reporting → Enable TCP Server API)
- Verify the port is `2442`
- Check firewall rules if running on different machines
- js8web retries automatically — check log output for errors

### Web interface shows no messages
- Confirm js8web is connected (check log: "Connected to JS8call")
- Ensure JS8Call is receiving signals
- Refresh the browser page
- Try `curl http://localhost:8080/api/station-info` — it should return JSON

### Browser shows blank page or JS errors
- Open browser developer console (F12) for details
- Use a modern browser supporting ES modules and import maps (Chrome 89+, Firefox 108+, Safari 16.4+)
- Verify the URL is correct

### Inbox is empty
- JS8Call's inbox may genuinely be empty
- Check that JS8Call is connected and the TCP API is responding
- The inbox is fetched on every js8web startup — restart js8web to trigger a fresh fetch

### Rig controls have no effect
- Requires Operator or Admin role
- JS8Call must be connected (check the connection indicator in the status bar)

### Database errors on startup
- If the database is corrupted, stop js8web, delete `js8web.db`, and restart
- Ensure the directory is writable by the process user

---

## Security Considerations

> ⚠️ js8web does not currently support HTTPS/TLS.

- Authentication is required to send messages and use rig/inbox controls
- **Change the default admin/admin password immediately**
- Sessions do not survive server restarts (in-memory only)
- Session cookies are `HttpOnly` and `SameSite=Strict`
- Do not expose js8web to the internet without a reverse proxy with TLS, a VPN, or firewall rules
- All traffic including login credentials is unencrypted without HTTPS

---

## Limitations

- No HTTPS (use a reverse proxy for TLS)
- In-memory sessions (do not survive restarts)
- RX spot reports are stored but not yet displayed in the UI
- No unit or integration tests
