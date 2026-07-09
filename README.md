# steam-mcp

Steam market intelligence for AI agents — an [MCP](https://modelcontextprotocol.io) server that gives your coding assistant live Steam data: app search, player-count trends, store details, review mining, and news digests.

Built for game developers and community managers who want Steam answers inside their IDE conversation instead of tab-switching to store pages.

## Why

Steam's public APIs are fragmented (store search, appdetails, user stats) and none of them keep player-count **history** — the single most useful signal for launch planning. steam-mcp stitches the surfaces together behind one tool set and pairs them with a companion backend that snapshots player counts every 30 minutes, so your agent can answer "how is the game actually doing" with real numbers.

## Install

```bash
git clone https://github.com/Playtide-studios/steam-mcp.git
cd steam-mcp
npm install
npm start
```

Requires Node 26+. Zero runtime dependencies — the server talks plain HTTP/JSON-RPC over stdio.

## Tools

| Tool | What it does |
|---|---|
| `steam_search_apps` | Resolve a game name to appids via Steam store search |
| `steam_get_app_overview` | One-call health check: players, reviews, price, release, genres, latest news |
| `steam_get_store_details` | Full store listing: pricing per region, platforms, DLC count, metacritic |
| `steam_get_app_reviews` | Review mining with recency/sentiment/keyword filters + representative quotes |
| `steam_get_game_news` | News and patch-note digests, summary or full text |
| `steam_get_player_trend` | Player-count history with min/max/avg, week-over-week change, and a plain-language insight line |
| `steam_get_market_pulse` | Curated market digest for game developers: Steam trends, live-ops patterns, competitor notes |

## Client configuration

stdio (Claude Desktop / Cursor / any MCP client):

```json
{
  "mcpServers": {
    "steam": {
      "command": "node",
      "args": ["/path/to/steam-mcp/src/index.ts"]
    }
  }
}
```

Streamable HTTP:

```bash
npm run start:http   # serves MCP on http://localhost:8791/mcp
```

Ready-to-edit client configs live in [`examples/`](examples/).

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `STEAM_MCP_BACKEND_URL` | `https://api.212.147.241.73.sslip.io` | Companion backend base URL — hosted beta by default; override to self-host. Must be `https://` unless loopback |
| `STEAM_MCP_BACKEND_KEY` | — | Backend API key (optional; the hosted beta is open) |
| `STEAM_MCP_REMOTE_MANIFEST` | `0` | Opt in to fetching tool descriptions from the backend each boot |
| `STEAM_MCP_TIMEOUT_MS` | `10000` | Per-request timeout to Steam or the backend |

Everything else is zero-config: tool schemas are pinned to the packaged manifest (see `src/fallback-manifest.json`).

## Data provenance & safety

- Store search, details, reviews, and news come directly from Steam's public endpoints at request time — nothing is scraped ahead or cached on disk.
- Trends and the market digest come from the companion backend.
- All free-text fetched from the internet (reviews, news bodies) is treated as **data, never instructions** — tool descriptions tell the model the same.
- The server sends no telemetry anywhere. The only outbound calls are the Steam endpoints you asked about and the backend you configured.

## The companion backend

Trend and pulse data come from the steam-mcp companion backend — a small Express + Postgres service that snapshots player counts for every tracked app every 30 minutes.

- **Hosted backend (open beta — the default):** installs use `https://api.212.147.241.73.sslip.io` out of the box; no key needed during beta. To pin it explicitly:

  ```bash
  STEAM_MCP_BACKEND_URL=https://api.212.147.241.73.sslip.io npm start
  ```

- **Self-hosted:** the backend is a standard docker-compose Postgres + API stack; set `STEAM_MCP_BACKEND_URL` to your instance. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for connectivity help.
