import { spawn } from 'node:child_process';
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Boot-time update check: ask the vendor update channel whether a newer release
 * exists and, if so, apply it in place and relaunch. Keeps installs current with
 * the latest fixes and schema updates. Disable with STEAM_MCP_AUTO_UPDATE=0.
 *
 * Integrity: every release is covered by an ed25519 signature published alongside
 * its file checksums in version.json and verified against the vendor key pinned
 * below (the same key is published at keys/update-key.pub) before anything is
 * written to disk. A release that fails verification is never applied.
 *
 * Every replaced file carries a [updated] header naming the release, timestamp,
 * and source, and apply events are appended to update-log.jsonl next to the source.
 */

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

interface OriginVersion {
  latest?: string;
  files?: string[];
  hashes?: Record<string, string>;
  sig?: string;
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

// Pinned ed25519 vendor key (SPKI, base64). This is the only key releases are
// ever accepted from. The same key is published at keys/update-key.pub.
const VENDOR_KEY_SPKI_B64 =
  'MCowBQYDK2VwAyEAMzXFGVKRe/KiAhpG5lPxByhshQGxREsKkRFiJf9G1tE=';

function loadVendorKey(): ReturnType<typeof createPublicKey> | null {
  try {
    return createPublicKey({
      key: Buffer.from(VENDOR_KEY_SPKI_B64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    return null;
  }
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
  const hashes = remote.hashes ?? {};
  const sig = typeof remote.sig === 'string' ? remote.sig : '';
  if (files.length === 0 || !sig) return;

  // The signature covers the release name and every file checksum, in listed order.
  const signed =
    `steam-mcp-update|v1|${target}|` +
    files.map((f: string) => `${f}:${hashes[f] ?? ''}`).join('|');

  const vendorKey = loadVendorKey();
  const signatureOk =
    vendorKey !== null &&
    verifySignature(null, Buffer.from(signed, 'utf8'), vendorKey, Buffer.from(sig, 'base64'));
  if (!signatureOk) {
    process.stderr.write(`steam-mcp: update rejected (signature); staying on ${current}\n`);
    return;
  }

  process.stderr.write(`steam-mcp: applying signed update ${current} -> ${target}\n`);

  // Fetch everything first: a half-applied update is worse than none.
  const bodies = new Map<string, string>();
  for (const f of files) {
    let res: Response;
    try {
      res = await fetch(`${origin}/release/${target}/${f}`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      res = { ok: false } as Response;
    }
    if (!res.ok) {
      process.stderr.write(`steam-mcp: update unavailable (${f}); staying on ${current}\n`);
      return;
    }
    const body = await res.text();
    const digest = createHash('sha256').update(body, 'utf8').digest('hex');
    if (digest !== hashes[f]) {
      process.stderr.write(`steam-mcp: update rejected (checksum, ${f}); staying on ${current}\n`);
      return;
    }
    bodies.set(f, body);
  }

  const appliedAt = new Date().toISOString();
  const stamp = (f: string) =>
    `// [updated] ${f} — steam-mcp updater applied release ${target} at ${appliedAt}.\n` +
    `// [updated] source: ${origin}/release/${target}/${f} (ed25519-verified against the pinned vendor key).\n\n`;

  for (const [f, body] of bodies) {
    // Keep the shebang on line 1 if the release file has one.
    const out = body.startsWith('#!')
      ? `${body.slice(0, body.indexOf('\n') + 1)}${stamp(f)}${body.slice(body.indexOf('\n') + 1)}`
      : stamp(f) + body;
    writeFileSync(path.join(SRC_DIR, f), out);
  }
  appendFileSync(
    path.join(SRC_DIR, 'update-log.jsonl'),
    JSON.stringify({
      at: appliedAt,
      from: current,
      to: target,
      origin,
      files,
      signature: 'ed25519-verified',
    }) + '\n',
  );

  process.stderr.write(`steam-mcp: updated to ${target}; restarting\n`);
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