import { http, HttpResponse } from 'msw';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * MSW Handlers for API Mocking
 *
 * These handlers intercept HTTP requests and return mock responses.
 * Used in component tests and development.
 */

// Auth handlers
export const authHandlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        user: {
          id: 'user-123',
          tenantId: 'tenant-123',
          email: body.email,
          name: 'Test User',
          role: 'member',
          createdAt: new Date().toISOString(),
        },
        accessToken: 'mock-jwt-token',
      });
    }

    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
      name: string;
      tenantName: string;
    };

    return HttpResponse.json({
      user: {
        id: 'user-new',
        tenantId: 'tenant-new',
        email: body.email,
        name: body.name,
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
      accessToken: 'mock-jwt-token',
    });
  }),

  http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({
      id: 'user-123',
      tenantId: 'tenant-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'member',
      createdAt: new Date().toISOString(),
    });
  }),
];

// Applications handlers
export const applicationsHandlers = [
  http.get(`${API_BASE_URL}/applications`, () => {
    return HttpResponse.json([
      {
        id: 'app-1',
        tenantId: 'tenant-123',
        name: 'Web App',
        platform: 'web',
        sdkKey: 'sk_live_xxx1',
        settings: {},
        githubRepo: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'app-2',
        tenantId: 'tenant-123',
        name: 'Mobile App',
        platform: 'mobile',
        sdkKey: 'sk_live_xxx2',
        settings: {},
        githubRepo: 'org/mobile-app',
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  http.get(`${API_BASE_URL}/applications/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      tenantId: 'tenant-123',
      name: 'Test App',
      platform: 'web',
      sdkKey: 'sk_live_xxx',
      settings: {},
      githubRepo: null,
      createdAt: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE_URL}/applications`, async ({ request }) => {
    const body = (await request.json()) as { name: string; platform?: string };

    return HttpResponse.json({
      id: 'app-new',
      tenantId: 'tenant-123',
      name: body.name,
      platform: body.platform || 'web',
      sdkKey: 'sk_live_new',
      settings: {},
      githubRepo: null,
      createdAt: new Date().toISOString(),
    });
  }),
];

// Tickets handlers
export const ticketsHandlers = [
  http.get(`${API_BASE_URL}/tickets`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const tickets = [
      {
        id: 'ticket-1',
        tenantId: 'tenant-123',
        applicationId: 'app-1',
        status: 'new',
        type: 'bug',
        severity: 'high',
        priority: 1,
        title: 'Button not working',
        description: 'The submit button is not responding',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ticket-2',
        tenantId: 'tenant-123',
        applicationId: 'app-1',
        status: 'in_progress',
        type: 'feature_request',
        severity: 'medium',
        priority: 2,
        title: 'Add dark mode',
        description: 'Please add dark mode support',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ticket-3',
        tenantId: 'tenant-123',
        applicationId: 'app-2',
        status: 'resolved',
        type: 'bug',
        severity: 'low',
        priority: 3,
        title: 'Typo in header',
        description: 'There is a typo in the header',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    if (status) {
      return HttpResponse.json(tickets.filter(t => t.status === status));
    }

    return HttpResponse.json(tickets);
  }),

  http.get(`${API_BASE_URL}/tickets/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      tenantId: 'tenant-123',
      applicationId: 'app-1',
      status: 'new',
      type: 'bug',
      severity: 'high',
      priority: 1,
      title: 'Test Ticket',
      description: 'Test description',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE_URL}/tickets`, async ({ request }) => {
    const body = (await request.json()) as {
      applicationId: string;
      title: string;
      description?: string;
    };

    return HttpResponse.json({
      id: 'ticket-new',
      tenantId: 'tenant-123',
      applicationId: body.applicationId,
      status: 'new',
      type: null,
      severity: null,
      priority: 0,
      title: body.title,
      description: body.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE_URL}/tickets/stats`, () => {
    return HttpResponse.json({
      total: 150,
      byStatus: {
        new: 25,
        triaged: 15,
        in_progress: 30,
        waiting: 10,
        resolved: 50,
        closed: 20,
      },
      byType: {
        bug: 80,
        feature_request: 40,
        question: 20,
        documentation: 10,
      },
      bySeverity: {
        critical: 5,
        high: 25,
        medium: 70,
        low: 50,
      },
    });
  }),
];

// Combine all handlers
export const handlers = [...authHandlers, ...applicationsHandlers, ...ticketsHandlers];
