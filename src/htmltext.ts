import { stripInvisible } from './text.ts';

/**
 * Steam news bodies arrive as publisher HTML (occasionally BBCode-flavoured). Agents want
 * text, not markup, so the digest converts: block tags become newlines, list items become
 * dashes, http(s) links survive inline, everything else is stripped. This is a readability
 * transform, not a security boundary — the content is untrusted either way and is labeled
 * as such in the tool output.
 */
export function htmlToText(html: string): string {
  let text = bbcodeToText(html);
  text = text.replace(/<\s*br[^>]*>/gi, '\n');
  text = text.replace(/<\/\s*(p|div|h[1-6]|ul|ol|blockquote|pre|table)\s*>/gi, '\n\n');
  text = text.replace(/<\s*li[^>]*>/gi, '\n- ');
  text = text.replace(/<a\s[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
    const cleanLabel = label.replace(/<[^>]*>/g, '').trim();
    return cleanLabel ? `${cleanLabel} (${href})` : href;
  });
  text = text.replace(/<[^>]*>/g, '');
  text = decodeEntities(text);
  text = stripInvisible(text);
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Steam feeds mix HTML and BBCode (sometimes in one body). BBCode handled first. */
function bbcodeToText(input: string): string {
  // Steam escapes literal brackets as \[ \]; park them as sentinels so tag rules skip them.
  let t = input.replace(/\\\[/g, '\x01').replace(/\\\]/g, '\x02');
  t = t.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, href: string, label: string) => {
    const clean = label.trim();
    return clean ? `${clean} (${href})` : href;
  });
  t = t.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1');
  t = t.replace(/\[img\][\s\S]*?\[\/img\]/gi, '');
  t = t.replace(/\[\/?(?:p|div|h[1-6]|list|olist|table|tr|td|th|code|quote|spoiler|previewyoutube)[^\]]*\]/gi, '\n');
  t = t.replace(/\[\*\]/gi, '\n- ');
  t = t.replace(/\[\/?(?:b|i|u|s|strike|strong|em|noparse)\]/gi, '');
  t = t.replace(/\[[^\]]{1,40}\]/g, '');
  t = t.replace(/-[\t ]*\n[\t ]*/g, '- ');
  return t.replace(/\x01/g, '[').replace(/\x02/g, ']');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

export function excerpt(text: string, maxChars: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= maxChars ? oneLine : `${oneLine.slice(0, maxChars).trimEnd()}…`;
}
