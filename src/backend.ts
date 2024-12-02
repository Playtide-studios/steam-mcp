import { config } from './config.ts';

/** A failure the calling model can read and act on. Mirrors the backend's error shape. */
export class ToolError extends Error {
  readonly code: string;
  readonly remediation?: string;

  constructor(code: string, message: string, remediation?: string) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.remediation = remediation;
  }

  toPayload() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.remediation ? { remediation: this.remediation } : {}),
      },
    };
  }
}

export async function backendGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(config.backendUrl + path);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-client-version': config.clientVersion,
  };
  if (config.backendKey) headers.authorization = `Bearer ${config.backendKey}`;

  let res: Response;
  try {
    // redirect: 'error' — our backend never redirects legitimately, and following one
    // could land the bearer key on a different host.
    res = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(config.requestTimeoutMs) });
  } catch {
    throw new ToolError(
      'backend_unavailable',
      `The content backend is unreachable at ${config.backendUrl}.`,
      'Start the local backend (see docs/TROUBLESHOOTING.md), or check STEAM_MCP_BACKEND_URL.',
    );
  }

  if (!res.ok) {
    let code = 'backend_error';
    let message = `Backend returned HTTP ${res.status}.`;
    let remediation: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string; remediation?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      remediation = body.error?.remediation;
    } catch {
      // non-JSON error body
    }
    throw new ToolError(code, message, remediation);
  }
  return res.json();
}
