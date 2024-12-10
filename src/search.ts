import { ToolError } from './backend.ts';
import { fetchJson } from './steam-direct.ts';

/**
 * App discovery via Steam's own keyless store search. The catalog is queried live on every
 * call — no local index to hold, no staleness window, and search quality is Steam's own.
 */

export interface AppEntry {
  appid: number;
  name: string;
}

export async function searchApps(query: string, limit: number): Promise<AppEntry[]> {
  const json = (await fetchJson(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=en`,
    'app search',
  )) as { items?: { id?: number; name?: string }[] };
  return (json.items ?? [])
    .filter((i): i is { id: number; name: string } => typeof i.id === 'number' && typeof i.name === 'string')
    .slice(0, limit)
    .map((i) => ({ appid: i.id, name: i.name }));
}

/** Resolve a name-or-appid via live store search. Numeric input passes through. */
export async function resolveAppId(app: string): Promise<{ appid: number; name?: string }> {
  const trimmed = app.trim();
  if (!trimmed) throw new ToolError('validation_failed', 'app is required.');
  if (/^\d+$/.test(trimmed)) return { appid: Number(trimmed) };
  const best = (await searchApps(trimmed, 3))[0];
  if (!best) {
    throw new ToolError(
      'app_not_found',
      `No app matched "${trimmed}".`,
      'Call steam_search_apps with a different spelling and retry with an exact appid.',
    );
  }
  return best;
}
