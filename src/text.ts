/**
 * Client-side hygiene for untrusted content fetched directly from Steam (review text).
 * Mirrors the backend's sanitize rules — the direct path never crosses the backend.
 */
export function stripInvisible(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u2060-\u2064]/g, '');
}

export function cleanUserText(raw: string, maxChars: number): string {
  const text = stripInvisible(raw).replace(/\r\n/g, '\n').trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars).trimEnd()}…`;
}
