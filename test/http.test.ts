import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { httpConfig, startHttpServer, type HttpConfig } from '../src/http.ts';
import { loadManifest } from '../src/manifest.ts';

let server: Server;
let base: string;

const testCfg = (over: Partial<HttpConfig> = {}): HttpConfig => ({
  bind: '127.0.0.1',
  port: 0,
  allowedHosts: new Set(['localhost', '127.0.0.1', '::1', '[::1]']),
  allowedOrigins: new Set(),
  ...over,
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

before(async () => {
  const { manifest } = await loadManifest();
  server = startHttpServer(manifest, testCfg());
  await new Promise((r) => server.on('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test('initialize and tools/list round-trip over HTTP', async () => {
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
  assert.equal(init.status, 200);
  assert.equal((await init.json()).result.serverInfo.name, 'steam-mcp');

  const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal((await list.json()).result.tools.length, 7);
});

test('DNS-rebinding defense: foreign Host header is rejected', async () => {
  // fetch/undici strips Host (forbidden header); node:http sends it verbatim.
  const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(
      `${base}/mcp`,
      { method: 'POST', headers: { 'content-type': 'application/json', host: 'evil.com' } },
      (r) => {
        let body = '';
        r.on('data', (c) => (body += c));
        r.on('end', () => resolve({ status: r.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
  });
  assert.equal(res.status, 403);
  assert.equal(JSON.parse(res.body).error, 'forbidden_host');
});

test('DNS-rebinding defense: foreign Origin is rejected', async () => {
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'forbidden_origin');
});

test('allowlisted Origin is accepted', async () => {
  const { manifest } = await loadManifest();
  const srv = startHttpServer(manifest, testCfg({ allowedOrigins: new Set(['https://inspector.example']) }));
  await new Promise((r) => srv.on('listening', r));
  const port = (srv.address() as AddressInfo).port;
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://inspector.example' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  });
  assert.equal(res.status, 200);
  srv.close();
});

test('method, path, content-type, and body-shape gates', async () => {
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  const noMethod = await post({ jsonrpc: '2.0', id: 9 });
  assert.equal((await noMethod.json()).error.code, -32601);
  assert.equal((await fetch(`${base}/other`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status, 415);
  const bad = await post('{not json');
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, -32700);
  assert.equal((await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }])).status, 400);
});

test('notifications get 202 with no body', async () => {
  const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), '');
});

test('healthz answers on the allowlisted host', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('bearer token gate when configured', async () => {
  const { manifest } = await loadManifest();
  const srv = startHttpServer(manifest, testCfg({ token: 'sekrit' }));
  await new Promise((r) => srv.on('listening', r));
  const port = (srv.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/mcp`;
  const noAuth = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
  assert.equal(noAuth.status, 401);
  const withAuth = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer sekrit' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
  assert.equal(withAuth.status, 200);
  srv.close();
});

test('refuses non-loopback bind without a token', () => {
  process.env.STEAM_MCP_HTTP_BIND = '0.0.0.0';
  delete process.env.STEAM_MCP_HTTP_TOKEN;
  assert.throws(() => httpConfig(), /without STEAM_MCP_HTTP_TOKEN/);
  delete process.env.STEAM_MCP_HTTP_BIND;
});
