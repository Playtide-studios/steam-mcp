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
