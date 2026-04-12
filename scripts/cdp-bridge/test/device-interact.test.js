import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdbInputTextArgv } from '../dist/tools/device-interact.js';

// Empirically verified correct on Pixel 9 Pro API 37 + adb 1.0.41 via
// `verify-b96.mjs` (13/14 cases pass end-to-end). The one failing case is
// B97 (literal `%s` in user text → space), which is pre-existing and
// unrelated to the argv shape this file tests.

test('buildAdbInputTextArgv wraps chunk in single-quoted shell literal', () => {
  assert.deepEqual(buildAdbInputTextArgv('hello'), ['shell', 'input', 'text', "'hello'"]);
});

test('buildAdbInputTextArgv replaces spaces with %s inside the quoted literal', () => {
  assert.deepEqual(
    buildAdbInputTextArgv('hello world'),
    ['shell', 'input', 'text', "'hello%sworld'"],
  );
  assert.deepEqual(
    buildAdbInputTextArgv('a b c d'),
    ['shell', 'input', 'text', "'a%sb%sc%sd'"],
  );
});

test("buildAdbInputTextArgv escapes embedded single quotes via POSIX '\\'' dance", () => {
  assert.deepEqual(
    buildAdbInputTextArgv("it's"),
    ['shell', 'input', 'text', "'it'\\''s'"],
  );
  assert.deepEqual(
    buildAdbInputTextArgv("a'b'c"),
    ['shell', 'input', 'text', "'a'\\''b'\\''c'"],
  );
});

test('buildAdbInputTextArgv keeps shell metacharacters inside quotes (no escape needed)', () => {
  assert.deepEqual(
    buildAdbInputTextArgv('a$b`c\\d'),
    ['shell', 'input', 'text', "'a$b`c\\d'"],
  );
  assert.deepEqual(
    buildAdbInputTextArgv('a|b&c;d'),
    ['shell', 'input', 'text', "'a|b&c;d'"],
  );
  assert.deepEqual(
    buildAdbInputTextArgv('a<b>c*d?e[f]'),
    ['shell', 'input', 'text', "'a<b>c*d?e[f]'"],
  );
});

test('buildAdbInputTextArgv handles empty string', () => {
  assert.deepEqual(buildAdbInputTextArgv(''), ['shell', 'input', 'text', "''"]);
});

test('buildAdbInputTextArgv returns a fresh argv array on each call', () => {
  const a = buildAdbInputTextArgv('x');
  const b = buildAdbInputTextArgv('x');
  assert.notEqual(a, b);
  a.push('mutated');
  assert.equal(b.length, 4);
});
