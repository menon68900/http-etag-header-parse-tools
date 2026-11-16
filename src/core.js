const WEAK_PREFIX = 'W/';

function isQuote(ch) {
  return ch === '"';
}

/**
 * Parse a single entity-tag from a string. Returns null if the string is not
 * a valid entity-tag. The grammar is taken from RFC 7232 section 2.3:
 *   entity-tag = [ weak ] opaque-tag
 *   weak       = %x57.2F ; "W/", case-sensitive
 *   opaque-tag = DQUOTE *etagc DQUOTE
 *   etagc      = %x21 / %x23-7E / obs-text
 *
 * We deliberately reject strings with trailing data rather than parsing a
 * prefix, because callers of this library need to know whether the whole
 * header value is a valid entity-tag.
 */
export function parseETag(input) {
  if (typeof input !== 'string') return null;
  let pos = 0;

  let weak = false;
  if (input.startsWith(WEAK_PREFIX)) {
    weak = true;
    pos = 2;
  }

  if (pos >= input.length) return null;
  if (!isQuote(input[pos])) return null;
  pos++;

  const valueStart = pos;
  while (pos < input.length && input[pos] !== '"') {
    const c = input.charCodeAt(pos);
    // etagc excludes DQUOTE (handled by the loop condition), space, and
    // control characters. obs-text is allowed in the ABNF but we reject it
    // because it is not valid in an HTTP/1.1 header field value without
    // encoding; accepting it would make the parser more permissive than the
    // rest of the stack.
    if (c <= 0x20 || c === 0x7f || c > 0x7e) return null;
    pos++;
  }
  if (pos >= input.length) return null; // missing closing quote

  const value = input.slice(valueStart, pos);
  pos++; // closing quote

  if (pos !== input.length) return null; // trailing garbage

  return { weak, value };
}

/**
 * Parse a comma-separated list of entity-tags. Empty elements are skipped
 * because the list grammar allows optional whitespace around commas and we
 * want to be tolerant of the common "a, b, c" form without requiring the
 * caller to split first. If any element is not a valid entity-tag the whole
 * list is rejected; returning a partial list would hide a malformed header.
 */
export function parseETagList(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed === '') return [];

  const parts = trimmed.split(',');
  const result = [];
  for (const part of parts) {
    const tag = parseETag(part.trim());
    if (tag === null) return null;
    result.push(tag);
  }
  return result;
}

/**
 * Compare two entity-tags for the purpose of If-Match / If-None-Match.
 * RFC 7232 section 2.3.2 defines weak comparison as matching only the opaque
 * value, ignoring the weak prefix. Strong comparison requires both tags to be
 * strong and the opaque values to match. We expose both because the two
 * conditional headers use different rules: If-Match uses strong comparison,
 * If-None-Match uses weak comparison.
 */
export function weakCompare(a, b) {
  if (a == null || b == null) return false;
  return a.value === b.value;
}

export function strongCompare(a, b) {
  if (a == null || b == null) return false;
  if (a.weak || b.weak) return false;
  return a.value === b.value;
}

/**
 * Evaluate an If-Match header against a current entity-tag.
 *
 * The header value may be a list of entity-tags or the literal "*".
 * If-Match uses strong comparison, so a weak current tag never matches.
 * A missing current tag (resource does not exist) fails the condition
 * unless the header is "*".
 *
 * Returns true when the condition passes (the request should proceed).
 */
export function ifMatch(headerValue, currentTag) {
  if (typeof headerValue !== 'string') return false;
  const trimmed = headerValue.trim();
  if (trimmed === '*') {
    return currentTag != null;
  }
  const list = parseETagList(trimmed);
  if (list === null) return false;
  if (currentTag == null) return false;
  return list.some((tag) => strongCompare(tag, currentTag));
}

/**
 * Evaluate an If-None-Match header against a current entity-tag.
 *
 * The header value may be a list of entity-tags or the literal "*".
 * If-None-Match uses weak comparison, so a weak current tag matches a
 * strong list entry and vice versa.
 *
 * Returns true when the condition passes (the request should proceed).
 */
export function ifNoneMatch(headerValue, currentTag) {
  if (typeof headerValue !== 'string') return true;
  const trimmed = headerValue.trim();
  if (trimmed === '*') {
    return currentTag == null;
  }
  const list = parseETagList(trimmed);
  if (list === null) return true;
  if (currentTag == null) return true;
  return !list.some((tag) => weakCompare(tag, currentTag));
}
