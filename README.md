# SoloForge - Solo Bitcoin Miner

<p align="center">
  <img src="frontend/public/assets/icon-block.png" alt="SoloForge Logo" width="100">
</p>

Solo Bitcoin mining dashboard. A Go backend mines via the Stratum protocol and streams live stats to a React dashboard over WebSocket. It also ships a **backend-free demo** that performs real SHA-256d proof-of-work client-side in the browser.

**Live demo:** [solo-btc.sohbi.dev](https://solo-btc.sohbi.dev) — mining runs entirely in your browser (real hashing on a live Bitcoin block from mempool.space). It won't realistically find a block; that's the point of solo mining.

## Screenshots

<p align="center">
  <img src="screenshots/dashboard-dark.png" alt="SoloForge dashboard — dark mode, mining" width="820">
</p>

<p align="center">
  <img src="screenshots/dashboard-light.png" alt="SoloForge dashboard — light mode" width="820">
</p>

## Features

- 🎰 **Solo Mining** - Connect to solo mining pools and try your luck at winning a full block reward
- 📊 **Real-time Dashboard** - Live hashrate, shares, difficulty, and worker statistics via WebSocket
- 📈 **Hashrate History Chart** - Live SVG sparkline of recent hashrate with current / peak / average
- 🎲 **Mining Odds Estimator** - Live "what are my real chances?" panel: expected time to a block and
  per-day / per-year probability derived from your hashrate vs. network difficulty
- 🌐 **Live Network Context** - The backend polls [mempool.space](https://mempool.space) for the real
  network difficulty, chain-tip height, total network hashrate and BTC/USD price. These feed the odds
  estimator (so it runs against *real* difficulty, not a hard-coded fallback), a "Bitcoin Network" panel
  on the dashboard, the `/api/network` endpoint, and `/metrics`. Polling is best-effort — a failed fetch
  keeps the last known value, so a flaky upstream never blanks the UI or stalls mining
- 📤 **Stats Export** - Download your share and session history as **CSV or JSON**, either from the
  dashboard (one click per tab, works in the demo too) or via the `/api/export` endpoint for automation
- 📟 **Prometheus Metrics** - `/metrics` endpoint exposes hashrate, shares, uptime, pool status **and live
  network context** (difficulty, height, network hashrate, price) for scraping by Prometheus / Grafana
- ⛏️ **Multi-Worker Support** - Run multiple mining workers simultaneously
- 🎚️ **CPU Throttling** - Control how much CPU power to dedicate to mining
- 🔧 **Configurable Pools** - Default to `solo.ckpool.org` or set your own
- 🔁 **Resilient Pool Connection** - Automatic reconnection with exponential backoff, plus proper
  `mining.set_difficulty` handling so shares are reported against the pool's share target
- 💾 **Persistent Configuration** - Settings changes are saved to disk and survive restarts. Updates are
  validated server-side (port range, CPU %, worker count) so bad input is rejected with a clear error
- 🔐 **Real Address Validation** - Wallet addresses are fully verified (Base58Check for `1`/`3`, Bech32 /
  Bech32m for `bc1`) on both the dashboard and the backend, so a mistyped payout address can't silently
  send a found block reward into the void. Live feedback flags typos before you ever start mining
- 🧹 **Durable Stats** - Statistics auto-save every 30s (so a crash or `docker kill` no longer wipes your
  history) and can be cleared from the dashboard via a Reset button. Saves are **atomic** (written to a
  temp file then renamed) so an interrupted write can never corrupt `stats.json`, and the storage location
  is configurable via the `DATA_DIR` environment variable
- 🩺 **Health & Readiness Probes** - `/healthz` (liveness) and `/readyz` (pool connected + authorized) plus
  graceful HTTP shutdown that drains in-flight requests on `SIGTERM`
- 🛡️ **Configurable Origins** - `ALLOWED_ORIGINS` locks down CORS *and* the WebSocket handshake to an
  explicit allowlist for hosted deployments (defaults to permissive for local dev)
- 🐳 **Dockerized** - One command to run the entire stack
- ✅ **Tested & CI** - Go unit tests for the mining/stats/config/address logic **and** a frontend Vitest
  suite (formatters, odds math, address + SHA-256 validation, component render) with ESLint, all run on
  every push via GitHub Actions

## Tech Stack

- **Backend**: Go 1.22 (Stratum protocol, WebSocket, REST API)
- **Frontend**: React 18 + Vite (Glassmorphism UI)
- **Infrastructure**: Docker + Docker Compose

## Quick Start

### Using Docker (Recommended)

```bash
# Clone and start
docker-compose up --build

# Open http://localhost:3000
```

### Manual Development

**Backend:**
```bash
cd backend
go mod download
go run ./cmd/soloforge
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Testing

The backend ships with a unit-test suite covering the SHA-256d mining math (validated
against the Bitcoin genesis block), target/difficulty conversion, Bitcoin address
validation (P2PKH / P2SH / Bech32 / Bech32m), the stats collector (including persistence
round-trips), the Stratum protocol parsing and the HTTP layer (health probes + CORS).

```bash
cd backend
go test ./...            # run all tests
go test -race ./...      # run with the race detector
```

The frontend has its own Vitest suite (display formatters, mining-odds math, SHA-256
vectors, address validation kept in sync with the Go vectors, and an `OddsPanel` render
test) plus ESLint:

```bash
cd frontend
npm test                 # run the Vitest suite
npm run lint             # run ESLint
```

CI (`.github/workflows/ci.yml`) runs `gofmt`, `go vet`, the race-enabled tests and a
build for the backend, and lints, tests and builds the frontend (standard + demo) on
every push and PR.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Pool URL | Mining pool address | `solo.ckpool.org` |
| Pool Port | Mining pool port | `3333` |
| CPU % | Maximum CPU usage | `80%` |
| Workers | Number of mining threads | `1` |

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POOL_URL` | Mining pool address | `solo.ckpool.org` |
| `POOL_PORT` | Mining pool port | `3333` |
| `ALLOWED_ORIGINS` | Comma-separated CORS/WebSocket origin allowlist (e.g. `https://miner.example.com`). Empty = allow all | _(empty)_ |
| `DATA_DIR` | Directory where `stats.json` is persisted | `/app/data` |
| `MEMPOOL_API_URL` | Base URL for the network-context explorer API | `https://mempool.space` |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Miner status |
| GET | `/api/stats` | Mining statistics |
| POST | `/api/stats/reset` | Clear all statistics and history |
| GET | `/api/history` | Share history |
| GET | `/api/network` | Live Bitcoin network context (difficulty, height, hashrate, price) |
| GET | `/api/export` | Download history as CSV/JSON (`?dataset=shares\|sessions&format=csv\|json`) |
| GET | `/metrics` | Prometheus-format metrics |
| GET | `/healthz` | Liveness probe (always 200 while serving) |
| GET | `/readyz` | Readiness probe (200 when pool connected + authorized, else 503) |
| GET/POST | `/api/workers` | Worker management |
| GET/PUT | `/api/config` | Configuration |
| POST | `/api/mining/start` | Start mining |
| POST | `/api/mining/stop` | Stop mining |
| WS | `/ws` | Real-time stats |

## Screenshots

The dashboard features a premium dark theme with glassmorphism effects:
- Frosted glass stat cards
- Gold accent gradients
- Smooth animations
- 3D rendered icons

## Disclaimer

⚠️ Solo mining Bitcoin with a CPU is essentially a lottery. The probability of finding a block is extremely low. This project is for educational purposes and to experience the thrill of the chase.

Current block reward: **3.125 BTC** (~$150,000 USD)

## License

MIT
