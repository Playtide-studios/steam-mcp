# Troubleshooting

## Error: `backend_unavailable` — the backend is unreachable

Trend and pulse data come from the companion backend. The default `STEAM_MCP_BACKEND_URL`
is the Playtide hosted beta (`https://api.playtide.dev`, open beta — no key needed).

- On releases older than 0.2.0 the default was a local instance (`http://localhost:8787`);
  set `STEAM_MCP_BACKEND_URL=https://api.playtide.dev` explicitly, or update.
- Self-hosting: start your backend instance and point `STEAM_MCP_BACKEND_URL` at it.

Check connectivity: `curl $STEAM_MCP_BACKEND_URL/healthz` should return `{"ok":true}`.

## Error: `STEAM_MCP_BACKEND_URL must use https://`

The backend URL must use `https://` unless it is a loopback address (`localhost`,
`127.0.0.1`, `::1`) — http is allowed only for local development backends. This is a
startup-time check; fix the URL and boot again.

## Error: `deprecated_client` (HTTP 409) on trend calls

The companion backend now serves **trend schema v2** and requires steam-mcp >= 0.2.0.
Installs older than that get `deprecated_client` on `steam_get_player_trend` calls until
updated — the call will keep failing until the install is current, so update rather
than retry.

### Update the install

For a git checkout, from the repo root:

```bash
git pull --ff-only origin main
npm install
```

For an npm global install:

```bash
npm update -g steam-mcp
```

The server also checks the vendor update channel automatically at boot and applies the
current release in place (stamped `[AUTO-UPDATED]`, logged to `update-log.jsonl`; see
README → Auto-update). A restart applies any pending release.

### Verify the new build before returning to your client

Start the server once and confirm it boots clean against the backend:

```bash
STEAM_MCP_BACKEND_URL=<your backend URL> node src/index.ts
```

A clean boot (version banner on stderr, no errors) means the current build is active.
If your client configuration is complex, verify in a scratch checkout instead:

```bash
git fetch origin && git worktree add /tmp/steam-mcp-next origin/main
```

## Error: `app_not_found` on a game that exists

Name matching is exact after search. Call `steam_search_apps` first and pass the returned
`appid` — names with special characters (™, commas) can be ambiguous.

## Error: `rate_limited` (HTTP 429)

The backend rate-limits per IP. Back off for the `Retry-After` interval; if you self-host,
raise `RATE_LIMIT_PER_MIN` on the backend.

## Tool results look stale

Trend points are cached briefly on the backend (snapshots land every 30 minutes). Store
details and reviews are fetched live from Steam at call time.