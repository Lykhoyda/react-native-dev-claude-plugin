import { okResult, failResult, withConnection } from '../utils.js';
export function createHeapUsageHandler(getClient) {
    return withConnection(getClient, async (_args, client) => {
        try {
            const result = await client.send('Runtime.getHeapUsage', undefined);
            return okResult({
                usedMB: Number(((result.usedSize ?? 0) / 1024 / 1024).toFixed(2)),
                totalMB: Number(((result.totalSize ?? 0) / 1024 / 1024).toFixed(2)),
                usedBytes: result.usedSize ?? 0,
                totalBytes: result.totalSize ?? 0,
                utilization: result.totalSize ? Number(((result.usedSize ?? 0) / result.totalSize * 100).toFixed(1)) : 0,
            });
        }
        catch (err) {
            return failResult(`Heap usage unavailable: ${err instanceof Error ? err.message : err}`);
        }
    });
}
export function createCpuProfileHandler(getClient) {
    return withConnection(getClient, async (args, client) => {
        if (!client.profilerAvailable) {
            return failResult('Profiler domain is not available on this Hermes target.', { hint: 'Check cdp_status domains.profiler' });
        }
        const duration = Math.min(Math.max(args.durationMs ?? 3000, 500), 30000);
        try {
            await client.send('Profiler.enable', undefined);
            await client.send('Profiler.start', undefined);
            await new Promise(r => setTimeout(r, duration));
            const result = await client.send('Profiler.stop', undefined);
            await client.send('Profiler.disable', undefined);
            const profile = result.profile;
            if (!profile?.nodes) {
                return failResult('Profiler returned empty profile');
            }
            const hotFunctions = profile.nodes
                .filter(n => (n.hitCount ?? 0) > 0)
                .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
                .slice(0, 20)
                .map(n => ({
                name: n.callFrame.functionName || '(anonymous)',
                url: n.callFrame.url,
                line: n.callFrame.lineNumber,
                hitCount: n.hitCount ?? 0,
            }));
            return okResult({
                durationMs: duration,
                nodeCount: profile.nodes.length,
                hotFunctions,
                startTime: profile.startTime,
                endTime: profile.endTime,
            });
        }
        catch (err) {
            try {
                await client.send('Profiler.disable', undefined);
            }
            catch { /* cleanup */ }
            return failResult(`CPU profiling failed: ${err instanceof Error ? err.message : err}`);
        }
    });
}
