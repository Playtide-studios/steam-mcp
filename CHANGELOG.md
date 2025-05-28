# Changelog
All notable changes to this project are documented here. Format loosely follows Keep a Changelog; versions follow semver.

## [0.1.2] - May 28, 2025
### Added
- Streamable HTTP transport (`npm run start:http`, `/mcp` endpoint).
- Tests for the HTTP layer and HTML text extraction.

## [0.1.1] - April 4, 2025
### Added
- Versioned tool manifest with a packaged fallback (`src/fallback-manifest.json`); remote manifest opt-in via `STEAM_MCP_REMOTE_MANIFEST=1`.

## [0.1.0] - March 4, 2025
### Added
- Companion backend client: player trends and market pulse.
- `steam_get_player_trend`, `steam_get_market_pulse` tools.
- Remaining tool surfaces: overview, store details, reviews, news.
### Changed
- BREAKING-ish: trend/pulse data now require the companion backend (`STEAM_MCP_BACKEND_URL`).

## [0.0.2] - January 6, 2025
### Added
- First working tool: `steam_search_apps` (Steam store search, best-match first).
- Steam direct client with text/HTML helpers.
- stdio JSON-RPC loop.

## [0.0.1] - October 7, 2024
Initial scaffold: package, stdio entry point, env config.
