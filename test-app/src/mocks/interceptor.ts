const BASE_URL = 'https://api.testapp.local';

interface MockRoute {
  method: string;
  pattern: RegExp;
  handler: (url: URL) => { status: number; body: unknown };
}

const routes: MockRoute[] = [
  {
    method: 'GET',
    pattern: /\/api\/feed$/,
    handler: (url) => {
      if (url.searchParams.get('error') === 'true') {
        return { status: 500, body: { error: 'Internal Server Error', message: 'Feed service unavailable' } };
      }
      return {
        status: 200,
        body: [
          { id: '1', title: 'First Post', body: 'Hello from the test app feed' },
          { id: '2', title: 'Second Post', body: 'Testing network log capture' },
          { id: '3', title: 'Third Post', body: 'MSW mock response' },
        ],
      };
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/user\/profile$/,
    handler: () => ({
      status: 200,
      body: { name: 'Test User', email: 'test@rndevagent.com', avatar: 'https://placeholders.dev/40x40' },
    }),
  },
  {
    method: 'POST',
    pattern: /\/api\/user\/profile$/,
    handler: () => ({ status: 200, body: { success: true } }),
  },
  {
    method: 'POST',
    pattern: /\/api\/notifications\/read$/,
    handler: () => ({ status: 204, body: null }),
  },
  {
    method: 'POST',
    pattern: /\/api\/notifications\/[^/]+\/read$/,
    handler: () => ({ status: 204, body: null }),
  },
  {
    method: 'POST',
    pattern: /\/api\/tasks\/sync$/,
    handler: () => ({ status: 200, body: { synced: true } }),
  },
  {
    method: 'GET',
    pattern: /\/api\/sync$/,
    handler: () => ({ status: 200, body: { synced: true } }),
  },
];

const originalFetch = globalThis.fetch;

function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (!url.startsWith(BASE_URL)) {
    return originalFetch(input, init);
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  const parsed = new URL(url);

  for (const route of routes) {
    if (route.method === method && route.pattern.test(parsed.pathname)) {
      const { status, body } = route.handler(parsed);
      const responseBody = body !== null ? JSON.stringify(body) : '';
      return Promise.resolve(
        new Response(responseBody, {
          status,
          headers: body !== null ? { 'Content-Type': 'application/json' } : {},
        }),
      );
    }
  }

  return Promise.resolve(new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 }));
}

export function enableMockFetch(): void {
  globalThis.fetch = mockFetch as typeof globalThis.fetch;
}
