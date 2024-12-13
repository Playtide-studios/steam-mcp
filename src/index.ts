#!/usr/bin/env node
import { config } from './config.ts';
import { startStdioLoop } from './jsonrpc.ts';
import { loadManifest } from './manifest.ts';

const { manifest, source } = await loadManifest();

process.stderr.write(
  `steam-mcp ${config.clientVersion} ready (backend: ${config.backendUrl}, manifest: ${manifest.manifest_version}, ${source})\n`,
);

startStdioLoop(manifest);
