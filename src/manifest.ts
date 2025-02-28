import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';

export interface ManifestTool {
  description: string;
  guidance?: string;
}

export interface Manifest {
  manifest_version: string;
  tools: Record<string, ManifestTool>;
  notes?: string[];
}

const FALLBACK_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fallback-manifest.json');

/**
 * Tool descriptions/guidance are PINNED to the packaged manifest by default:
 * the text the model sees is exactly what was reviewed at install time, and a
 * backend deploy cannot change this server's behavior post-install.
 *
 * Rationale: tool descriptions and guidance are instructions the client model
 * trusts. A backend that can rewrite them post-install is a behavior channel
 * that bypasses every code review, pin, and lockfile — even when capabilities
 * (names, schemas) stay fixed in code. See README "Security model".
 *
 * Operators who want backend-served descriptions (e.g. running their own
 * backend) can opt in with STEAM_MCP_REMOTE_MANIFEST=1. The remote manifest
 * can only override the *text* of tools this build already ships, and any
 * fetch or shape problem falls back to the packaged copy.
 */
export interface LoadedManifest {
  manifest: Manifest;
  /** Where the active manifest came from — surfaced in the startup log line. */
  source: 'packaged' | 'server';
}

export async function loadManifest(): Promise<LoadedManifest> {
  const fallback = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8')) as Manifest;
  if (process.env.STEAM_MCP_REMOTE_MANIFEST !== '1') return { manifest: fallback, source: 'packaged' };
  try {
    const url = new URL(`${config.backendUrl}/v1/manifest`);
    url.searchParams.set('current_version', fallback.manifest_version);
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const remote = (await res.json()) as Partial<Manifest> & { not_modified?: boolean };
    if (remote.not_modified) return { manifest: fallback, source: 'packaged' };
    if (typeof remote.manifest_version !== 'string' || typeof remote.tools !== 'object' || remote.tools === null) {
      throw new Error('manifest shape invalid');
    }
    const merged: Manifest = { manifest_version: remote.manifest_version, tools: { ...fallback.tools } };
    for (const name of Object.keys(fallback.tools)) {
      const remoteTool = remote.tools[name];
      if (remoteTool && typeof remoteTool.description === 'string' && remoteTool.description.length > 0) {
        merged.tools[name] = {
          description: remoteTool.description,
          guidance:
            typeof remoteTool.guidance === 'string' && remoteTool.guidance.length > 0
              ? remoteTool.guidance
              : fallback.tools[name].guidance,
        };
      }
    }
    merged.notes = Array.isArray(remote.notes) ? remote.notes.filter((n) => typeof n === 'string') : fallback.notes;
    return { manifest: merged, source: 'server' };
  } catch {
    process.stderr.write('steam-mcp: manifest fetch failed, using packaged copy\n');
    return { manifest: fallback, source: 'packaged' };
  }
}
