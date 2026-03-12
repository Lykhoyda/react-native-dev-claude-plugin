export function okResult(data, opts) {
    const envelope = { ok: true, data };
    if (opts?.truncated)
        envelope.truncated = true;
    if (opts?.meta)
        envelope.meta = opts.meta;
    return { content: [{ type: 'text', text: JSON.stringify(envelope) }] };
}
export function failResult(error, meta) {
    const envelope = { ok: false, error };
    if (meta)
        envelope.meta = meta;
    return { content: [{ type: 'text', text: JSON.stringify(envelope) }], isError: true };
}
export function warnResult(data, warning, meta) {
    const envelope = { ok: true, data, meta: { ...meta, warning } };
    return { content: [{ type: 'text', text: JSON.stringify(envelope) }] };
}
export function withConnection(getClient, handler, options = {}) {
    const { requireHelpers = true } = options;
    return async (args) => {
        const client = getClient();
        try {
            if (!client.isConnected) {
                try {
                    await client.autoConnect();
                }
                catch (connectErr) {
                    const msg = connectErr instanceof Error ? connectErr.message : String(connectErr);
                    if (msg.includes('Already connecting')) {
                        // Reconnection in progress — wait up to 15s for it to complete
                        const deadline = Date.now() + 15_000;
                        while (!client.isConnected && Date.now() < deadline) {
                            await new Promise(r => setTimeout(r, 500));
                        }
                        if (!client.isConnected) {
                            return failResult('Reconnection timed out. Call cdp_status to retry.');
                        }
                    }
                    else {
                        return failResult(`Auto-connect failed: ${msg}`);
                    }
                }
            }
            if (requireHelpers && !client.helpersInjected) {
                const helperDeadline = Date.now() + 5_000;
                while (!client.helpersInjected && Date.now() < helperDeadline) {
                    await new Promise(r => setTimeout(r, 300));
                }
                if (!client.helpersInjected) {
                    return failResult('Connected but helpers not injected. App may still be loading — retry in a few seconds.');
                }
            }
            return await handler(args, client);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const isDisconnect = message.includes('WebSocket closed') || message.includes('WebSocket not connected');
            if (isDisconnect) {
                // Wait for reconnect and retry once
                const retryDeadline = Date.now() + 15_000;
                while (!client.isConnected && Date.now() < retryDeadline) {
                    await new Promise(r => setTimeout(r, 500));
                }
                if (client.isConnected) {
                    if (requireHelpers && !client.helpersInjected) {
                        const hd = Date.now() + 5_000;
                        while (!client.helpersInjected && Date.now() < hd) {
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }
                    if (!requireHelpers || client.helpersInjected) {
                        try {
                            return await handler(args, client);
                        }
                        catch (retryErr) {
                            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                            return failResult(`Retry after reconnect failed: ${retryMsg}`);
                        }
                    }
                }
                return failResult('Connection lost during operation and reconnect timed out.');
            }
            return failResult(message);
        }
    };
}
