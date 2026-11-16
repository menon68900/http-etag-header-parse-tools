import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseETag,
  parseETagList,
  weakCompare,
  strongCompare,
  ifMatch,
  ifNoneMatch,
} from '../src/index.js';

test('parseETag accepts a strong tag', () => {
  assert.deepEqual(parseETag('"abc"'), { weak: false, value: 'abc' });
});

test('parseETag accepts a weak tag', () => {
  assert.deepEqual(parseETag('W/"abc"'), { weak: true, value: 'abc' });
});

test('parseETag rejects missing quotes', () => {
  assert.equal(parseETag('abc'), null);
});

test('parseETag rejects trailing data', () => {
  assert.equal(parseETag('"abc" '), null);
  assert.equal(parseETag('"abc"x'), null);
});

test('parseETag rejects control characters inside the value', () => {
  assert.equal(parseETag('"a\u0001b"'), null);
});

test('parseETag rejects an empty string', () => {
  assert.equal(parseETag(''), null);
});

test('parseETag rejects a bare weak prefix', () => {
  assert.equal(parseETag('W/'), null);
});

test('parseETagList parses multiple tags', () => {
  assert.deepEqual(parseETagList('"a", W/"b"'), [
    { weak: false, value: 'a' },
    { weak: true, value: 'b' },
  ]);
});

test('parseETagList returns an empty list for an empty string', () => {
  assert.deepEqual(parseETagList('   '), []);
});

test('parseETagList rejects a malformed element', () => {
  assert.equal(parseETagList('"a", nope'), null);
});

test('weakCompare ignores the weak prefix', () => {
  assert.equal(
    weakCompare({ weak: true, value: 'x' }, { weak: false, value: 'x' }),
    true,
  );
  assert.equal(
    weakCompare({ weak: true, value: 'x' }, { weak: false, value: 'y' }),
    false,
  );
});

test('strongCompare rejects any weak tag', () => {
  assert.equal(
    strongCompare({ weak: true, value: 'x' }, { weak: false, value: 'x' }),
    false,
  );
  assert.equal(
    strongCompare({ weak: false, value: 'x' }, { weak: false, value: 'x' }),
    true,
  );
});

test('ifMatch accepts a matching strong tag', () => {
  assert.equal(ifMatch('"a"', { weak: false, value: 'a' }), true);
});

test('ifMatch rejects a weak current tag', () => {
  assert.equal(ifMatch('"a"', { weak: true, value: 'a' }), false);
});

test('ifMatch with star requires an existing resource', () => {
  assert.equal(ifMatch('*', { weak: false, value: 'a' }), true);
  assert.equal(ifMatch('*', null), false);
});

test('ifMatch fails when the resource does not exist', () => {
  assert.equal(ifMatch('"a"', null), false);
});

test('ifNoneMatch uses weak comparison', () => {
  assert.equal(ifNoneMatch('"a"', { weak: true, value: 'a' }), false);
});

test('ifNoneMatch passes when there is no match', () => {
  assert.equal(ifNoneMatch('"a"', { weak: false, value: 'b' }), true);
});

test('ifNoneMatch with star passes only when the resource is absent', () => {
  assert.equal(ifNoneMatch('*', null), true);
  assert.equal(ifNoneMatch('*', { weak: false, value: 'a' }), false);
});

test('ifNoneMatch passes when the header is malformed', () => {
  assert.equal(ifNoneMatch('nope', { weak: false, value: 'a' }), true);
});
