/** Zero-dependency env config. The backend defaults to the Playtide hosted beta. */
const env = process.env;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * The backend URL is the one operator-configurable URL this package fetches. Per MCP
 * security best practices it must be https, except loopback for local development.
 * Fails fast at startup rather than mid-session.
 */
function validateBackendUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`STEAM_MCP_BACKEND_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'https:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      `STEAM_MCP_BACKEND_URL must use https:// (http:// is allowed only for loopback dev backends). Got: ${raw}`,
    );
  }
  return raw;
}

export const config = {
  /** Content backend base URL. Defaults to the Playtide hosted beta; override to self-host. */
  backendUrl: validateBackendUrl((env.STEAM_MCP_BACKEND_URL ?? 'https://api.playtide.dev').replace(/\/+$/, '')),

  /** Optional backend API key for the hosted service. Not needed during the open beta. */
  backendKey: env.STEAM_MCP_BACKEND_KEY || undefined,

  requestTimeoutMs: Number(env.STEAM_MCP_TIMEOUT_MS ?? 10_000),

  clientVersion: '0.2.0',
} as const;
