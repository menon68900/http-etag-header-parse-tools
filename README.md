# http-etag-header-parse-tools

Parses and compares HTTP entity-tag values, handling weak (`W/`) prefixes, quoted-string syntax, and the If-Match / If-None-Match validation rules.

```js
import {
  parseETag,
  parseETagList,
  weakCompare,
  strongCompare,
  ifMatch,
  ifNoneMatch,
} from 'http-etag-header-parse-tools';

parseETag('W/"abc"');            // { weak: true, value: 'abc' }
parseETagList('"a", W/"b"');    // [ { weak: false, value: 'a' }, { weak: true, value: 'b' } ]
weakCompare(parseETag('W/"a"'), parseETag('"a"'));   // true
strongCompare(parseETag('W/"a"'), parseETag('"a"')); // false
ifMatch('"a"', { weak: false, value: 'a' });          // true
ifNoneMatch('"a"', { weak: true, value: 'a' });       // false
```

## Why this exists

Conditional requests are easy to get subtly wrong. The two conditional headers use different comparison rules: `If-Match` requires strong comparison and rejects weak tags, while `If-None-Match` uses weak comparison and treats a weak tag as a match. A single boolean `etagEquals` helper cannot express both. This library keeps parsing and comparison separate so the caller can apply the correct rule, and it refuses to guess when a header is malformed rather than silently dropping the invalid part.

The trade-off: `parseETag` rejects any string that is not exactly one entity-tag, including trailing whitespace. Header parsing code that wants to tolerate sloppy input should trim before calling. This makes the parser predictable and keeps the comparison functions from having to re-validate their inputs.

## Edge case

`parseETag` rejects non-ASCII bytes inside the opaque value. RFC 7232 allows `obs-text` in the ABNF, but a raw byte above `0x7e` is not valid in an HTTP/1.1 header field value without encoding, so accepting it would make this parser more permissive than the transport that produced the header. Callers that need to round-trip arbitrary bytes should encode them before building the tag.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

