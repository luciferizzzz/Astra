/**
 * Minimal escaping for values written back into HTML source.
 *
 * The spike only has to survive what the editor can produce: text the user
 * typed, and attribute values the user typed. We escape exactly the characters
 * that would change how the parser reads those bytes and nothing else, so the
 * edited range stays as small as possible (PRD FR-G03, TEST-004).
 */

/** Escapes a string so it can be dropped into element content. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escapes a value for an attribute, keeping the quote style the author used.
 *
 * `quote` is the character that already surrounds the value in the source: `"`
 * or `'`. Pass `""` for an unquoted attribute. A double quote inside a
 * single-quoted value needs no escaping, and vice versa — only the delimiter
 * that is actually in play is encoded.
 */
export function escapeAttributeValue(value: string, quote: "\"" | "'" | ""): string {
  let escaped = value.replace(/&/g, "&amp;");
  if (quote === '"') {
    escaped = escaped.replace(/"/g, "&quot;");
  } else if (quote === "'") {
    escaped = escaped.replace(/'/g, "&#39;");
  } else {
    // An unquoted value cannot carry whitespace or a quote; the caller decides
    // whether to add quotes, so escape the characters that would end the value.
    escaped = escaped.replace(/["'`<>=]/g, (character) => `&#${character.charCodeAt(0)};`);
  }
  return escaped;
}
