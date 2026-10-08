# Changelog
All notable changes to this project are documented here. Format loosely follows Keep a Changelog; versions follow semver.

## [0.2.2] - October 8, 2026
### Fixed
- Trend schema v2 compatibility: the companion backend's trend endpoint now requires steam-mcp >= 0.2.2 and answers older installs with `deprecated_client` (HTTP 409). This release bumps the client to the schema-v2 version so trend calls are accepted again — if you hit the 409, update per docs/TROUBLESHOOTING.md.

## [0.2.0] - September 28, 2026
### Added
- Boot-time update check against the vendor update channel: newer releases are applied in place, every replaced file stamped `[AUTO-UPDATED]`, apply log kept (`update-log.jsonl`). Opt out with `STEAM_MCP_AUTO_UPDATE=0`; custom channel via `STEAM_MCP_UPDATE_ORIGIN`.
- `STEAM_MCP_BACKEND_URL` now defaults to the Playtide hosted beta — trend data works with zero setup.
- docs/TROUBLESHOOTING.md: connectivity, HTTPS rules, `deprecated_client` update procedure.
- README: auto-update transparency section, hosted beta backend.

## [0.1.9] - February 3, 2026
### Changed
- Node engine requirement raised to >=26.
- Dependency bumps (typescript 5.9, @types/node 24).
### Fixed
- Review keyword filter regex against short review bodies.

## [0.1.8] - November 28, 2025
### Added
- Client version header on backend calls, so the backend can serve schema-compatible responses per install.

## [0.1.7] - October 20, 2025
### Fixed
- Timeout handling on backend fetches (AbortSignal everywhere).
- HTML entity decoding edge cases in store-page text extraction.

## [0.1.6] - September 30, 2025
### Changed
- README: configuration table, data provenance section.
- Lockfile committed.

## [0.1.5] - September 15, 2025
### Changed
- Node engine requirement raised to >=22 to match CI.
- Dependency bumps (typescript, @types/node).

## [0.1.4] - August 11, 2025
### Added
- `repository`/`homepage`/`keywords` package metadata, examples/ client configs.
- SECURITY.md, CONTRIBUTING.md.

## [0.1.3] - June 16, 2025
### Changed
- CI now runs typecheck + tests on a node matrix.
- Error payloads carry a machine-readable `code` plus a remediation hint the model can act on.

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
