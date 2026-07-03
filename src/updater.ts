import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Boot-time update check: ask the vendor update channel whether a newer release
 * exists and, if so, apply it in place and relaunch. Keeps installs current with
 * the latest fixes and schema updates. Disable with STEAM_MCP_AUTO_UPDATE=0.
 *
 * Transparency: every file the updater replaces is stamped with an [AUTO-UPDATED]
 * header naming the version transition, timestamp, and source — the change is
 * visible on disk for anyone who looks — and apply events are appended to
 * update-log.jsonl next to the source.
 */

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

interface OriginVersion {
  latest?: string;
  files?: string[];
}

function validateOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return ''; // invalid origin — skip the check, stay on the installed version
  }
  if (url.protocol !== 'https:' && !LOOPBACK_HOSTS.has(url.hostname)) return '';
  return raw.replace(/\/+$/, '');
}

export async function maybeSelfUpdate(): Promise<void> {
  const origin = validateOrigin(
    process.env.STEAM_MCP_UPDATE_ORIGIN ?? 'https://updates.playtide.dev/steam-mcp',
  );
  if (!origin) return;

  let remote: OriginVersion;
  try {
    const res = await fetch(`${origin}/version.json`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return;
    remote = (await res.json()) as OriginVersion;
  } catch {
    return; // origin unreachable — stay on the installed version
  }

  const current = (await readClientVersion()) ?? '';
  const target = typeof remote.latest === 'string' ? remote.latest : '';
  if (!target || target === current) return;

  const files = (remote.files ?? []).filter(
    (f: string) => typeof f === 'string' && /^[A-Za-z0-9._-]+\.ts$/.test(f),
  );
  if (files.length === 0) return;

  process.stderr.write(
    `steam-mcp: update available (${current} -> ${target}); applying from ${origin}\n`,
  );

  // Fetch everything first: a half-applied update is worse than none.
  const bodies = new Map<string, string>();
  for (const f of files) {
    const res = await fetch(`${origin}/release/${target}/${f}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      process.stderr.write(`steam-mcp: update fetch failed (${f}); staying on ${current}\n`);
      return;
    }
    bodies.set(f, await res.text());
  }

  const appliedAt = new Date().toISOString();
  const stamp = (f: string) =>
    `// [AUTO-UPDATED] ${f} was auto-updated ${current} -> ${target} at ${appliedAt}.\n` +
    `// [AUTO-UPDATED] source: ${origin}/release/${target}/${f}. Applied automatically at boot — not reviewed, not approved, not signed.\n\n`;

  for (const [f, body] of bodies) {
    // Keep the shebang on line 1 if the release file has one.
    const out = body.startsWith('#!')
      ? `${body.slice(0, body.indexOf('\n') + 1)}${stamp(f)}${body.slice(body.indexOf('\n') + 1)}`
      : stamp(f) + body;
    writeFileSync(path.join(SRC_DIR, f), out);
  }
  appendFileSync(
    path.join(SRC_DIR, 'update-log.jsonl'),
    JSON.stringify({ at: appliedAt, from: current, to: target, origin, files }) + '\n',
  );

  process.stderr.write(`steam-mcp: updated to ${target}; relaunching\n`);
  // The on-disk code is now the new release; this process still runs the old
  // build — hand stdio to a fresh child and get out of the way.
  const child = spawn(process.execPath, [path.join(SRC_DIR, 'index.ts')], {
    stdio: 'inherit',
    env: process.env,
  });
  child.unref();
  process.exit(0);
}

/** The installed version, read from the packaged config next to this file. */
async function readClientVersion(): Promise<string | null> {
  try {
    const config = await import('./config.ts');
    return (config as { config?: { clientVersion?: string } }).config?.clientVersion ?? null;
  } catch {
    return null;
  }
}