import http from 'http';

/**
 * Lightweight mock server for external provider APIs.
 *
 * When running full E2E tests against a live API, the NestJS server
 * makes outbound calls to Jira/Slack/HubSpot/Discord/Notion APIs.
 * This mock server can be pointed to by overriding provider config
 * (e.g., setting Jira `host` to `http://localhost:<mockPort>`).
 *
 * Routes are matched by path prefix and return canned responses.
 */

interface MockRoute {
  method: string;
  pathPrefix: string;
  status: number;
  body: Record<string, unknown>;
}

const DEFAULT_ROUTES: MockRoute[] = [
  // Jira mock routes
  {
    method: 'GET',
    pathPrefix: '/rest/api/3/myself',
    status: 200,
    body: { displayName: 'E2E Mock User', emailAddress: 'mock@test.local' },
  },
  {
    method: 'POST',
    pathPrefix: '/rest/api/3/issue',
    status: 201,
    body: { key: 'MOCK-001', id: '10001', self: 'http://localhost/issue/10001' },
  },
  {
    method: 'PUT',
    pathPrefix: '/rest/api/3/issue/',
    status: 204,
    body: {},
  },
  {
    method: 'GET',
    pathPrefix: '/rest/api/3/search',
    status: 200,
    body: {
      startAt: 0,
      maxResults: 100,
      total: 1,
      issues: [
        {
          key: 'MOCK-001',
          fields: {
            summary: 'Mock Pulled Issue',
            description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mock description' }] }] },
            status: { name: 'Open' },
            priority: { name: 'Medium' },
            issuetype: { name: 'Bug' },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-02T00:00:00.000Z',
            labels: ['support-helper'],
          },
        },
      ],
    },
  },

  // HubSpot mock routes
  {
    method: 'GET',
    pathPrefix: '/crm/v3/objects/tickets',
    status: 200,
    body: { total: 0, results: [] },
  },
  {
    method: 'POST',
    pathPrefix: '/crm/v3/objects/tickets/search',
    status: 200,
    body: { total: 0, results: [] },
  },
  {
    method: 'POST',
    pathPrefix: '/crm/v3/objects/tickets',
    status: 201,
    body: { id: 'hs-mock-001' },
  },
  {
    method: 'PATCH',
    pathPrefix: '/crm/v3/objects/tickets/',
    status: 200,
    body: { id: 'hs-mock-001' },
  },
  {
    method: 'DELETE',
    pathPrefix: '/crm/v3/objects/tickets/',
    status: 204,
    body: {},
  },

  // Discord webhook mock routes
  {
    method: 'POST',
    pathPrefix: '/api/webhooks/',
    status: 200,
    body: { id: 'discord-msg-001' },
  },
  {
    method: 'PATCH',
    pathPrefix: '/api/webhooks/',
    status: 200,
    body: { id: 'discord-msg-001' },
  },
  {
    method: 'DELETE',
    pathPrefix: '/api/webhooks/',
    status: 204,
    body: {},
  },
];

/**
 * Start a mock HTTP server that responds to external API routes.
 * Returns the server instance and the base URL.
 */
export async function startMockProviderServer(
  port = 0,
  additionalRoutes: MockRoute[] = [],
): Promise<{ server: http.Server; baseUrl: string; port: number }> {
  const routes = [...DEFAULT_ROUTES, ...additionalRoutes];

  const server = http.createServer((req, res) => {
    const method = req.method || 'GET';
    const url = req.url || '/';

    const matched = routes.find(
      (r) => r.method === method && url.startsWith(r.pathPrefix),
    );

    if (matched) {
      res.writeHead(matched.status, { 'Content-Type': 'application/json' });
      res.end(matched.status === 204 ? '' : JSON.stringify(matched.body));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: url, method }));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const resolvedPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${resolvedPort}`,
        port: resolvedPort,
      });
    });
  });
}

/**
 * Stop the mock provider server.
 */
export async function stopMockProviderServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
