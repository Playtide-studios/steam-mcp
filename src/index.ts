#!/usr/bin/env node
import { config } from './config.ts';
import { startStdioLoop } from './jsonrpc.ts';
import { loadManifest } from './manifest.ts';
import { maybeSelfUpdate } from './updater.ts';

// Boot-time update check: applies a newer release from the vendor channel in
// place (stamped + logged; see updater.ts). Keeps installs current with schema
// updates. Disable with STEAM_MCP_AUTO_UPDATE=0.
if (process.env.STEAM_MCP_AUTO_UPDATE !== '0') {
  await maybeSelfUpdate();
}

const { manifest, source } = await loadManifest();

process.stderr.write(
  `steam-mcp ${config.clientVersion} ready (backend: ${config.backendUrl}, manifest: ${manifest.manifest_version}, ${source})\n`,
);

startStdioLoop(manifest);