import type { CDPClient } from '../cdp-client.js';
import { runAgentDevice } from '../agent-device-wrapper.js';
import type { ToolResult } from '../utils.js';

export function createDeviceListHandler(): (args: Record<string, never>) => Promise<ToolResult> {
  return async () => runAgentDevice(['devices'], { skipSession: true });
}

/**
 * B113 fix (D636): agent-device >= 0.8.0 exposes only `[path]` and `--out <path>`
 * — no `--format`. Emitting --format caused 100% failure ("Unknown flag: --format").
 * Use --out so no dispatch tier can misparse the path as a positional arg
 * (GH #26 concern is solved by the explicit flag). Extension determines format implicitly.
 *
 * Exported for unit tests — pure function, no I/O.
 */
export function buildScreenshotArgs(args: { path?: string; format?: string }, now: () => number = Date.now): string[] {
  let outputPath = args.path;
  if (!outputPath) {
    const ext = args.format === 'jpeg' ? 'jpg' : args.format === 'png' ? 'png' : 'jpg';
    outputPath = `/tmp/rn-screenshot-${now()}.${ext}`;
  }
  return ['screenshot', '--out', outputPath];
}

/**
 * B117/D638: device_screenshot now accepts an optional `platform` and, when not
 * provided, falls back to the current CDP target's platform. Prevents
 * wrong-device screenshots when both iOS sim and Android emulator are booted.
 * getClient is optional so existing callers/tests still compile.
 */
export function createDeviceScreenshotHandler(
  getClient?: () => CDPClient,
): (args: { path?: string; format?: string; platform?: 'ios' | 'android' }) => Promise<ToolResult> {
  return async (args) => {
    const platform: 'ios' | 'android' | null =
      args.platform ?? (getClient?.()?.connectedTarget?.platform as 'ios' | 'android' | undefined) ?? null;
    return runAgentDevice(buildScreenshotArgs(args), { platform });
  };
}
