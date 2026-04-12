import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdbInputTextArgv, splitChunkAroundPercentS } from '../dist/tools/device-interact.js';

// ── buildAdbInputTextArgv ──────────────────────────────────────────────

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

// ── splitChunkAroundPercentS (B97) ─────────────────────────────────────

test('splitChunkAroundPercentS returns chunk as-is when no %s present', () => {
  assert.deepEqual(splitChunkAroundPercentS('hello'), ['hello']);
  assert.deepEqual(splitChunkAroundPercentS('a%b'), ['a%b']);
  assert.deepEqual(splitChunkAroundPercentS('a%Sb'), ['a%Sb']);
  assert.deepEqual(splitChunkAroundPercentS(''), ['']);
});

test('splitChunkAroundPercentS splits single %s into [before, "%", "s"+after]', () => {
  assert.deepEqual(splitChunkAroundPercentS('a%sb'), ['a', '%', 'sb']);
});

test('splitChunkAroundPercentS handles %s at start', () => {
  assert.deepEqual(splitChunkAroundPercentS('%sb'), ['%', 'sb']);
});

test('splitChunkAroundPercentS handles %s at end', () => {
  assert.deepEqual(splitChunkAroundPercentS('a%s'), ['a', '%', 's']);
});

test('splitChunkAroundPercentS handles bare %s', () => {
  assert.deepEqual(splitChunkAroundPercentS('%s'), ['%', 's']);
});

test('splitChunkAroundPercentS handles two consecutive %s', () => {
  assert.deepEqual(splitChunkAroundPercentS('a%s%sb'), ['a', '%', 's', '%', 'sb']);
});

test('splitChunkAroundPercentS handles three %s in mixed text', () => {
  assert.deepEqual(
    splitChunkAroundPercentS('x%sy%sz%sw'),
    ['x', '%', 'sy', '%', 'sz', '%', 'sw'],
  );
});

test('splitChunkAroundPercentS preserves spaces (not yet encoded)', () => {
  assert.deepEqual(splitChunkAroundPercentS('a %s b'), ['a ', '%', 's b']);
});

test('splitChunkAroundPercentS + buildAdbInputTextArgv produce correct argv sequence', () => {
  const segments = splitChunkAroundPercentS('hello %s world');
  const argvs = segments.map(s => buildAdbInputTextArgv(s));
  assert.deepEqual(argvs, [
    ['shell', 'input', 'text', "'hello%s'"],
    ['shell', 'input', 'text', "'%'"],
    ['shell', 'input', 'text', "'s%sworld'"],
  ]);
});
