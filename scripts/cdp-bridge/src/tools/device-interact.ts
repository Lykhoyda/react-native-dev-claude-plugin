import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { runAgentDevice, getActiveSession, getCachedScreenRect } from '../agent-device-wrapper.js';
import { withSession } from '../utils.js';
import type { ToolResult } from '../utils.js';
import { okResult, failResult } from '../utils.js';

const execFile = promisify(execFileCb);

const ANDROID_UNSAFE_CHARS = /[+@#$%^&*(){}|\\<>~`[\]?*]/;
const ANDROID_FILL_MAX_SAFE_LEN = 30;

// --- Find ---

interface FindArgs {
  text: string;
  action?: string;
}

export function createDeviceFindHandler(): (args: FindArgs) => Promise<ToolResult> {
  return withSession(async (args) => {
    const cliArgs = ['find', args.text];
    if (args.action) cliArgs.push(args.action);
    const result = await runAgentDevice(cliArgs);

    // B92 fix: On AMBIGUOUS_MATCH, fetch a snapshot and return disambiguation candidates.
    if (result.isError) {
      const text = result.content?.[0]?.text ?? '';
      if (text.includes('AMBIGUOUS_MATCH') || text.includes('matched') && text.includes('elements')) {
        try {
          const snapshotResult = await runAgentDevice(['snapshot', '-i']);
          if (!snapshotResult.isError) {
            const envelope = JSON.parse(snapshotResult.content[0].text) as {
              ok?: boolean;
              data?: { nodes?: Array<{ ref: string; label?: string; identifier?: string; type?: string; hittable?: boolean; rect?: { x: number; y: number; width: number; height: number } }> };
            };
            if (envelope.ok && envelope.data?.nodes) {
              const query = args.text.toLowerCase();
              const candidates = envelope.data.nodes
                .filter((n) => {
                  const label = (n.label ?? '').toLowerCase();
                  const id = (n.identifier ?? '').toLowerCase();
                  return label.includes(query) || id.includes(query);
                })
                .slice(0, 10)
                .map((n) => ({
                  ref: n.ref,
                  label: n.label,
                  testID: n.identifier,
                  type: n.type,
                  hittable: n.hittable,
                  position: n.rect ? { x: n.rect.x, y: n.rect.y } : undefined,
                }));
              return failResult(
                `AMBIGUOUS_MATCH: "${args.text}" matched ${candidates.length} elements. Use device_press with one of these refs.`,
                {
                  code: 'AMBIGUOUS_MATCH',
                  query: args.text,
                  candidates,
                  hint: 'Pick the correct ref (prefer one with hittable=true) and call device_press(ref="...") directly.',
                },
              );
            }
          }
        } catch { /* fall through to original error */ }
      }
    }
    return result;
  });
}

// --- Press (enhanced with doubleTap, count, holdMs) ---

interface PressArgs {
  ref: string;
  doubleTap?: boolean;
  count?: number;
  holdMs?: number;
}

export function createDevicePressHandler(): (args: PressArgs) => Promise<ToolResult> {
  return withSession((args) => {
    const ref = args.ref.startsWith('@') ? args.ref : `@${args.ref}`;
    const cliArgs = ['press', ref];
    if (args.doubleTap) cliArgs.push('--double-tap');
    if (args.count && args.count > 1) cliArgs.push('--count', String(args.count));
    if (args.holdMs && args.holdMs > 0) cliArgs.push('--hold-ms', String(args.holdMs));
    return runAgentDevice(cliArgs);
  });
}

// --- Long Press ---

interface LongPressArgs {
  ref?: string;
  x?: number;
  y?: number;
  durationMs?: number;
}

export function createDeviceLongPressHandler(): (args: LongPressArgs) => Promise<ToolResult> {
  return withSession((args) => {
    if (args.ref) {
      const ref = args.ref.startsWith('@') ? args.ref : `@${args.ref}`;
      const cliArgs = ['press', ref, '--hold-ms', String(args.durationMs ?? 1000)];
      return runAgentDevice(cliArgs);
    }
    if (args.x != null && args.y != null) {
      const cliArgs = ['longpress', String(args.x), String(args.y)];
      if (args.durationMs) cliArgs.push(String(args.durationMs));
      return runAgentDevice(cliArgs);
    }
    return Promise.resolve(failResult('Provide either ref or x+y coordinates'));
  });
}

// --- Fill (with Android workaround) ---

interface FillArgs {
  ref: string;
  text: string;
}

function getAdbSerial(): string[] {
  const session = getActiveSession();
  if (session?.deviceId) return ['-s', session.deviceId];
  if (process.env.ANDROID_SERIAL) return ['-s', process.env.ANDROID_SERIAL];
  return [];
}

async function androidClipboardFill(text: string): Promise<ToolResult> {
  try {
    const serial = getAdbSerial();
    const chunks = [];
    for (let i = 0; i < text.length; i += 10) {
      chunks.push(text.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      // Replace spaces with %s (adb input text convention)
      // Use single-quoted shell string to prevent Android shell expansion
      // Single quotes inside the text must be escaped as '\''
      const escaped = chunk
        .replace(/ /g, '%s')
        .replace(/'/g, "'\\''");
      await execFile('adb', [...serial, 'shell', 'input', 'text', `'${escaped}'`], { timeout: 10000 });
    }
    return okResult({ filled: true, method: 'adb-chunked-input', length: text.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return failResult(`Android text input failed: ${msg}`);
  }
}

function isAndroidSession(): boolean {
  const session = getActiveSession();
  if (session?.platform === 'android') return true;
  if (session?.platform) return false;
  return !!process.env.ANDROID_SERIAL;
}

export function createDeviceFillHandler(): (args: FillArgs) => Promise<ToolResult> {
  return withSession(async (args) => {
    const ref = args.ref.startsWith('@') ? args.ref : `@${args.ref}`;
    const needsWorkaround = isAndroidSession() && (
      args.text.length > ANDROID_FILL_MAX_SAFE_LEN ||
      ANDROID_UNSAFE_CHARS.test(args.text)
    );

    if (needsWorkaround) {
      const pressResult = await runAgentDevice(['press', ref]);
      if (pressResult.isError) return pressResult;
      await new Promise((r) => setTimeout(r, 300));
      return androidClipboardFill(args.text);
    }

    return runAgentDevice(['fill', ref, args.text]);
  });
}

// --- Swipe (coordinate-based with direction shortcut) ---

interface SwipeArgs {
  direction?: 'up' | 'down' | 'left' | 'right';
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  durationMs?: number;
  count?: number;
  pattern?: 'one-way' | 'ping-pong';
}

// Default screen dimensions for common devices — used when screen rect cache is empty.
// Covers iPhone 17 Pro / 15 Pro / 14 Pro Max and similar Android 1080x2400 phones.
const DEFAULT_SCREEN = { width: 402, height: 874 };
const SWIPE_FRACTION = 0.4;
const DEFAULT_SWIPE_DURATION_MS = 300;

function computeSwipeFromDirection(
  direction: 'up' | 'down' | 'left' | 'right',
  screen: { width: number; height: number },
): { x1: number; y1: number; x2: number; y2: number } {
  const cx = Math.round(screen.width / 2);
  const cy = Math.round(screen.height / 2);
  const dy = Math.round(screen.height * SWIPE_FRACTION);
  const dx = Math.round(screen.width * SWIPE_FRACTION);
  switch (direction) {
    // "swipe down" means finger moves from top to bottom (pull-to-refresh gesture)
    case 'down': return { x1: cx, y1: cy - dy, x2: cx, y2: cy + dy };
    // "swipe up" means finger moves from bottom to top
    case 'up': return { x1: cx, y1: cy + dy, x2: cx, y2: cy - dy };
    case 'left': return { x1: cx + dx, y1: cy, x2: cx - dx, y2: cy };
    case 'right': return { x1: cx - dx, y1: cy, x2: cx + dx, y2: cy };
  }
}

export function createDeviceSwipeHandler(): (args: SwipeArgs) => Promise<ToolResult> {
  return withSession((args) => {
    if (args.x1 != null && args.y1 != null && args.x2 != null && args.y2 != null) {
      const cliArgs = ['swipe', String(args.x1), String(args.y1), String(args.x2), String(args.y2)];
      if (args.durationMs) cliArgs.push(String(args.durationMs));
      if (args.count && args.count > 1) cliArgs.push('--count', String(args.count));
      if (args.pattern) cliArgs.push('--pattern', args.pattern);
      return runAgentDevice(cliArgs);
    }
    if (args.direction) {
      // B-Tier3 fix: Use real swipe gesture (not scroll) for direction-based swipes.
      // The previous delegation to `scroll` produced smooth list scrolls that don't
      // trigger gesture handlers (pull-to-refresh, swipe-to-delete).
      const screen = getCachedScreenRect() ?? DEFAULT_SCREEN;
      const coords = computeSwipeFromDirection(args.direction, screen);
      const duration = args.durationMs ?? DEFAULT_SWIPE_DURATION_MS;
      const cliArgs = ['swipe', String(coords.x1), String(coords.y1), String(coords.x2), String(coords.y2), String(duration)];
      if (args.count && args.count > 1) cliArgs.push('--count', String(args.count));
      if (args.pattern) cliArgs.push('--pattern', args.pattern);
      return runAgentDevice(cliArgs);
    }
    return Promise.resolve(failResult('Provide either direction or x1,y1,x2,y2 coordinates'));
  });
}

// --- Scroll ---

interface ScrollArgs {
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export function createDeviceScrollHandler(): (args: ScrollArgs) => Promise<ToolResult> {
  return withSession((args) => {
    const cliArgs = ['scroll', args.direction];
    if (args.amount != null) cliArgs.push(String(args.amount));
    return runAgentDevice(cliArgs);
  });
}

// --- Scroll Into View ---

interface ScrollIntoViewArgs {
  text?: string;
  ref?: string;
}

export function createDeviceScrollIntoViewHandler(): (args: ScrollIntoViewArgs) => Promise<ToolResult> {
  return withSession((args) => {
    if (args.ref) {
      const ref = args.ref.startsWith('@') ? args.ref : `@${args.ref}`;
      return runAgentDevice(['scrollintoview', ref]);
    }
    if (args.text) {
      return runAgentDevice(['scrollintoview', args.text]);
    }
    return Promise.resolve(failResult('Provide either text or ref to scroll into view'));
  });
}

// --- Pinch ---

interface PinchArgs {
  scale: number;
  x?: number;
  y?: number;
}

export function createDevicePinchHandler(): (args: PinchArgs) => Promise<ToolResult> {
  return withSession((args) => {
    const cliArgs = ['pinch', String(args.scale)];
    if (args.x != null && args.y != null) {
      cliArgs.push(String(args.x), String(args.y));
    }
    return runAgentDevice(cliArgs);
  });
}

// --- Back ---

export function createDeviceBackHandler(): (args: Record<string, never>) => Promise<ToolResult> {
  return withSession(() => runAgentDevice(['back']));
}
