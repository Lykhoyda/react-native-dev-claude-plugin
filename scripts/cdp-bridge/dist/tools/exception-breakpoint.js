import { okResult, failResult, withConnection } from '../utils.js';
export function createExceptionBreakpointHandler(getClient) {
    return withConnection(getClient, async (args, client) => {
        const state = args.state ?? 'uncaught';
        const duration = args.durationMs ? Math.min(Math.max(args.durationMs, 1000), 30000) : undefined;
        const savedHandler = client['eventHandlers'].get('Debugger.paused');
        try {
            await client.send('Debugger.setPauseOnExceptions', { state });
            if (!duration) {
                return okResult({
                    state,
                    message: `Exception breakpoint set to "${state}". Call again with state="none" to disable.`,
                });
            }
            const caught = [];
            const captureHandler = async (params) => {
                const p = params;
                if (p.reason === 'exception' || p.reason === 'promiseRejection') {
                    const desc = p.data?.description ?? p.data?.value ?? 'Unknown exception';
                    const topFrame = p.callFrames?.[0];
                    caught.push({
                        message: String(desc).slice(0, 500),
                        url: topFrame?.url,
                        line: topFrame?.location?.lineNumber,
                        column: topFrame?.location?.columnNumber,
                        stackPreview: p.callFrames?.slice(0, 5).map(f => `  at ${f.functionName || '(anonymous)'} (${f.url ?? '?'}:${f.location?.lineNumber ?? '?'})`).join('\n'),
                    });
                }
                try {
                    await client.send('Debugger.resume', undefined);
                }
                catch { /* best effort */ }
            };
            client['eventHandlers'].set('Debugger.paused', captureHandler);
            await new Promise(r => setTimeout(r, duration));
            await client.send('Debugger.setPauseOnExceptions', { state: 'none' });
            if (savedHandler) {
                client['eventHandlers'].set('Debugger.paused', savedHandler);
            }
            return okResult({
                state: 'none',
                durationMs: duration,
                exceptionsCount: caught.length,
                exceptions: caught,
            });
        }
        catch (err) {
            if (savedHandler) {
                client['eventHandlers'].set('Debugger.paused', savedHandler);
            }
            try {
                await client.send('Debugger.setPauseOnExceptions', { state: 'none' });
            }
            catch { /* cleanup */ }
            return failResult(`Exception breakpoint failed: ${err instanceof Error ? err.message : err}`);
        }
    });
}
