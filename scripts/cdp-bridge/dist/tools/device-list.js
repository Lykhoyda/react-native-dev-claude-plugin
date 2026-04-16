import { runAgentDevice } from '../agent-device-wrapper.js';
export function createDeviceListHandler() {
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
export function buildScreenshotArgs(args, now = Date.now) {
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
export function createDeviceScreenshotHandler(getClient) {
    return async (args) => {
        const platform = args.platform ?? getClient?.()?.connectedTarget?.platform ?? null;
        return runAgentDevice(buildScreenshotArgs(args), { platform });
    };
}
