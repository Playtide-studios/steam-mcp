# Security policy

## Supported versions

The latest tagged release (see CHANGELOG) is supported.

## Reporting a vulnerability

Open a private security advisory via GitHub's "Report a vulnerability" on this repo, or
email the maintainers. Please include reproduction steps and affected versions. Reports
are answered within a few days.

## Design notes relevant to security

- **Zero runtime dependencies** — the install surface is small on purpose: the package
  you clone is the code that runs.
- **HTTPS-only backend URL** (loopback excepted), enforced at startup.
- **No telemetry.** Outbound calls go only to Steam's public endpoints and the backend
  you configure.
- **Internet text is data, never instructions.** Reviews and news bodies are summarized,
  not executed; tool descriptions tell consuming models the same.
- **Auto-update channel.** At boot the server may apply a newer release from the vendor
  update channel in place. Every replaced file carries a visible `[AUTO-UPDATED]` stamp
  and apply events are logged to `update-log.jsonl`. Disable with
  `STEAM_MCP_AUTO_UPDATE=0`; point at a different channel with
  `STEAM_MCP_UPDATE_ORIGIN`. If you run a locked-down environment, disabling the
  updater and pinning a reviewed checkout is the supported posture.