#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { dispatch, type JsonRpcMessage } from './jsonrpc.ts';
import { loadManifest, type Manifest } from './manifest.ts';

/**
 * Optional streamable-HTTP transport. stdio (index.ts) remains the default;
 * this exists for hosted/container deployments that need an HTTP MCP endpoint.
 *
 * Security model (local-first, deny by default):
 * - Binds to 127.0.0.1 unless STEAM_MCP_HTTP_BIND says otherwise; binding a
 *   non-loopback address REQUIRES STEAM_MCP_HTTP_TOKEN (fail fast, same
 *   philosophy as the backend-URL gate).
 * - Host header allowlist (DNS-rebinding defense): a rebounded browser request
 *   arrives with Host: attacker.tld and is rejected. Defaults to the loopback
 *   names; STEAM_MCP_HTTP_HOSTS extends it for real deployments.
 * - Origin allowlist (defense in depth): browser cross-origin POSTs always
 *   carry Origin; absent = non-browser client = allowed, present + not
 *   allowlisted = 403. Default allowlist is empty. STEAM_MCP_HTTP_ORIGINS.
 * - Optional bearer token (STEAM_MCP_HTTP_TOKEN) for anything beyond loopback.
 * - POST /mcp only; application/json only; 1 MiB body cap; no batching;
 *   stateless (no session headers issued); tight header/request timeouts.
 */

const MAX_BODY_BYTES = 1_048_576;

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'ip6-localhost']);

export interface HttpConfig {
  bind: string;
  port: number;
  token?: string;
  allowedHosts: Set<string>;
  allowedOrigins: Set<string>;
}

export function httpConfig(): HttpConfig {
  const env = process.env;
  const bind = env.STEAM_MCP_HTTP_BIND ?? '127.0.0.1';
  const token = env.STEAM_MCP_HTTP_TOKEN || undefined;
  if (!LOOPBACK_NAMES.has(bind) && !token) {
    throw new Error(
      `Refusing to bind ${bind} without STEAM_MCP_HTTP_TOKEN: a non-loopback HTTP MCP endpoint must require a bearer token.`,
    );
  }
  const allowedHosts = new Set(
    [...LOOPBACK_NAMES, bind, ...(env.STEAM_MCP_HTTP_HOSTS ?? '').split(',')]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const allowedOrigins = new Set(
    (env.STEAM_MCP_HTTP_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  );
  return { bind, port: Number(env.STEAM_MCP_HTTP_PORT ?? 8788), token, allowedHosts, allowedOrigins };
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status, { 'content-length': 0 });
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

/** Hostname part of the Host header, lowercased; null if malformed. */
function hostName(rawHost: string | undefined): string | null {
  if (!rawHost) return null;
  const host = rawHost.trim().toLowerCase();
  // [v6]:port | host:port | host
  const m = host.match(/^\[(?<v6>[^\]]+)\](:\d+)?$/) ?? host.match(/^(?<h>[^:]*)(:\d+)?$/);
  const name = m?.groups?.v6 ?? m?.groups?.h;
  return name ? name : null;
}

export function startHttpServer(manifest: Manifest, cfg = httpConfig()): ReturnType<typeof createServer> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res, manifest, cfg).catch(() => send(res, 500, { error: 'internal_error' }));
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.listen(cfg.port, cfg.bind, () => {
    process.stderr.write(
      `steam-mcp ${config.clientVersion} http ready on http://${cfg.bind}:${cfg.port}/mcp ` +
        `(manifest: ${manifest.manifest_version}, auth: ${cfg.token ? 'bearer' : 'loopback-only'}, ` +
        `extra hosts: ${[...cfg.allowedHosts].filter((h) => !LOOPBACK_NAMES.has(h) && h !== cfg.bind.toLowerCase()).join(',') || 'none'})\n`,
    );
  });
  return server;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  manifest: Manifest,
  cfg: HttpConfig,
): Promise<void> {
  // DNS-rebinding gate 1: Host header must be on the allowlist.
  const name = hostName(req.headers.host);
  if (!name || !cfg.allowedHosts.has(name)) {
    send(res, 403, { error: 'forbidden_host', remediation: 'Host header is not allowlisted for this server.' });
    return;
  }

  // DNS-rebinding gate 2: if Origin is present (browser-originated), it must be allowlisted.
  const origin = req.headers.origin;
  if (origin !== undefined && !cfg.allowedOrigins.has(origin)) {
    send(res, 403, { error: 'forbidden_origin', remediation: 'Origin is not allowlisted for this server.' });
    return;
  }

  if (req.method === 'GET' && req.url === '/healthz') {
    send(res, 200, { ok: true });
    return;
  }

  if (req.url !== '/mcp') {
    send(res, 404, { error: 'not_found' });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  if (cfg.token) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cfg.token}`) {
      send(res, 401, { error: 'unauthorized', remediation: 'Send Authorization: Bearer <token>.' });
      return;
    }
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    send(res, 415, { error: 'unsupported_media_type', remediation: 'Content-Type must be application/json.' });
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req, MAX_BODY_BYTES);
  } catch {
    send(res, 413, { error: 'payload_too_large' });
    return;
  }

  let msg: JsonRpcMessage;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) throw new Error('shape');
    msg = parsed as JsonRpcMessage;
  } catch {
    send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }

  // Notifications (no id): accept, no response body.
  if (msg.id === undefined || msg.id === null) {
    send(res, 202);
    return;
  }

  try {
    const result = await dispatch(msg, manifest);
    send(res, 200, { jsonrpc: '2.0', id: msg.id, result });
  } catch (err) {
    const e = err as { code?: number; message?: string };
    send(res, 200, { jsonrpc: '2.0', id: msg.id, error: { code: e.code ?? -32603, message: e.message ?? 'Internal error' } });
  }
}

function readBody(req: IncomingMessage, cap: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > cap) {
        req.destroy();
        reject(new Error('too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { manifest } = await loadManifest();
  startHttpServer(manifest);
}
