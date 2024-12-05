import { config } from './config.ts';
import { ToolError } from './backend.ts';
import { cleanUserText } from './text.ts';

/**
 * Direct client for Steam's keyless APIs (storefront + Web API). Everything current —
 * store details, reviews, news, player counts, the app catalog — is fetched straight from
 * Steam by the package. The companion backend is only used for what Steam does not retain
 * (snapshot trends) or author (the market digest).
 */

const STORE = 'https://store.steampowered.com';
const API = 'https://api.steampowered.com';

export async function fetchJson(url: string, what: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
  } catch {
    throw new ToolError('upstream_unavailable', `Steam is unreachable while fetching ${what}.`, 'Retry in a few seconds.');
  }
  if (!res.ok) {
    throw new ToolError(
      res.status === 429 ? 'rate_limited' : 'upstream_unavailable',
      `Steam returned HTTP ${res.status} for ${what}.`,
      'Retry after a short backoff.',
    );
  }
  return res.json();
}

export interface StoreDetails {
  appid: number;
  name: string;
  type: string | null;
  short_description: string | null;
  is_free: boolean;
  price: { currency: string; initial_cents: number; final_cents: number; discount_percent: number } | null;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  release_date: { coming_soon: boolean; date: string } | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  categories: string[];
  dlc_count: number;
  metacritic: number | null;
  header_image: string | null;
}

export async function getStoreDetails(appid: number, cc: string): Promise<StoreDetails | null> {
  const filters =
    'basic,name,steam_appid,type,short_description,is_free,price_overview,platforms,release_date,developers,publishers,genres,categories,dlc,metacritic,header_image';
  const json = (await fetchJson(
    `${STORE}/api/appdetails?appids=${appid}&cc=${encodeURIComponent(cc)}&l=en&filters=${filters}`,
    `store details for ${appid}`,
  )) as Record<string, { success?: boolean; data?: Record<string, unknown> }>;

  const entry = json[String(appid)];
  if (!entry?.success || !entry.data) return null;
  const d = entry.data;

  const price = d.price_overview as Record<string, unknown> | undefined;
  const genres = (d.genres as { description?: string }[] | undefined) ?? [];
  const categories = (d.categories as { description?: string }[] | undefined) ?? [];
  const metacritic = d.metacritic as { score?: number } | undefined;
  const release = d.release_date as { coming_soon?: boolean; date?: string } | undefined;
  const platforms = (d.platforms as StoreDetails['platforms'] | undefined) ?? { windows: false, mac: false, linux: false };

  return {
    appid,
    name: String(d.name ?? ''),
    type: (d.type as string) ?? null,
    short_description: d.short_description ? cleanUserText(String(d.short_description), 500) : null,
    is_free: Boolean(d.is_free),
    price:
      price && typeof price.final === 'number'
        ? {
            currency: String(price.currency ?? 'USD'),
            initial_cents: Number(price.initial ?? price.final),
            final_cents: Number(price.final),
            discount_percent: Number(price.discount_percent ?? 0),
          }
        : null,
    platforms: { windows: Boolean(platforms.windows), mac: Boolean(platforms.mac), linux: Boolean(platforms.linux) },
    release_date: release ? { coming_soon: Boolean(release.coming_soon), date: String(release.date ?? '') } : null,
    developers: (d.developers as string[]) ?? [],
    publishers: (d.publishers as string[]) ?? [],
    genres: genres.map((g) => g.description ?? '').filter(Boolean),
    categories: categories.map((c) => c.description ?? '').filter(Boolean).slice(0, 10),
    dlc_count: Array.isArray(d.dlc) ? d.dlc.length : 0,
    metacritic: typeof metacritic?.score === 'number' ? metacritic.score : null,
    header_image: (d.header_image as string) ?? null,
  };
}

export interface ReviewSummary {
  review_score_desc: string;
  total_positive: number;
  total_negative: number;
  total_reviews: number;
}

export interface RawReview {
  recommendationid: string;
  language: string;
  review: string;
  timestamp_created: number;
  voted_up: boolean;
  votes_up: number | string;
  playtime_forever?: number;
}

export interface ReviewPage {
  summary: ReviewSummary;
  reviews: RawReview[];
  cursor: string;
}

export interface ReviewFetchOpts {
  filter: 'recent' | 'all';
  reviewType: 'all' | 'positive' | 'negative';
  language: string;
  cursor?: string;
  numPerPage: number;
}

export async function getAppReviews(appid: number, opts: ReviewFetchOpts): Promise<ReviewPage | null> {
  const params = new URLSearchParams({
    json: '1',
    filter: opts.filter,
    language: opts.language,
    purchase_type: 'all',
    review_type: opts.reviewType,
    num_per_page: String(opts.numPerPage),
    cursor: opts.cursor ?? '*',
  });
  const json = (await fetchJson(`${STORE}/appreviews/${appid}?${params}`, `reviews for ${appid}`)) as {
    success?: number;
    query_summary?: ReviewSummary;
    reviews?: RawReview[];
    cursor?: string;
  };
  if (json.success !== 1) return null;
  return {
    summary: json.query_summary ?? {
      review_score_desc: 'Unknown',
      total_positive: 0,
      total_negative: 0,
      total_reviews: 0,
    },
    reviews: json.reviews ?? [],
    cursor: json.cursor ?? '',
  };
}

export interface RawNewsItem {
  gid: string;
  title: string;
  url: string;
  is_external_url?: boolean;
  author?: string;
  contents: string;
  feedlabel?: string;
  date: number;
  feedname?: string;
  tags?: string[];
}

export async function getNews(appid: number, count: number): Promise<RawNewsItem[]> {
  const json = (await fetchJson(
    `${API}/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=${count}&maxlength=0&format=json`,
    `news for ${appid}`,
  )) as { appnews?: { newsitems?: RawNewsItem[] } };
  return json.appnews?.newsitems ?? [];
}

export async function getCurrentPlayers(appid: number): Promise<number | null> {
  const json = (await fetchJson(
    `${API}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`,
    `player count for ${appid}`,
  )) as { response?: { result?: number; player_count?: number } };
  if (json.response?.result !== 1) return null;
  return json.response.player_count ?? null;
}
