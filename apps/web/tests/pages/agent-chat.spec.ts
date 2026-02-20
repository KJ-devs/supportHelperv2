import { test, expect, Page } from '@playwright/test';

/**
 * Agent Chat E2E Tests
 *
 * Diagnoses the "empty response" bug in the AI agent chat.
 * Intercepts API and WebSocket traffic to surface where content is lost.
 *
 * Prerequisites:
 *   - pnpm docker:up
 *   - pnpm db:seed  (creates owner@test.local, tickets, and one seeded agent session)
 *   - pnpm dev
 *   - OPENAI_API_KEY or ANTHROPIC_API_KEY set in .env.local
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.TEST_USER_EMAIL || 'owner@test.local';
const PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

// ---------------------------------------------------------------------------
// Shared login helper
// ---------------------------------------------------------------------------

async function loginAndGoTo(page: Page, path: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await page.waitForURL(/dashboard/);
  await page.goto(path);
}

// ---------------------------------------------------------------------------
// Get a ticket ID from the list (first row)
// ---------------------------------------------------------------------------

async function getFirstTicketId(page: Page): Promise<string> {
  await page.goto('/dashboard/tickets');
  await page.waitForLoadState('networkidle');

  // Try table rows first
  const firstRow = page.getByRole('row').nth(1);
  if (await firstRow.isVisible()) {
    // Grab href from the first link inside the row
    const link = firstRow.getByRole('link').first();
    if (await link.isVisible()) {
      const href = await link.getAttribute('href');
      if (href) {
        const match = href.match(/tickets\/([^/]+)/);
        if (match?.[1]) return match[1];
      }
    }
  }

  // Fallback: look for any link with /tickets/ in the href
  const anyLink = page.locator('a[href*="/tickets/"]').first();
  const href = await anyLink.getAttribute('href');
  if (href) {
    const match = href.match(/tickets\/([^/]+)/);
    if (match?.[1]) return match[1];
  }

  throw new Error('Could not find any ticket ID in the dashboard list');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Agent Chat', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL && EMAIL === 'owner@test.local'
      ? false   // use seed defaults → always run
      : !process.env.TEST_USER_EMAIL,
      'Test user not configured',
    );
  });

  // ── 1. Chat page loads correctly ─────────────────────────────────────────

  test('chat page loads and shows correct UI elements', async ({ page }) => {
    await loginAndGoTo(page, '/dashboard/tickets');
    const ticketId = await getFirstTicketId(page);

    await page.goto(`/dashboard/tickets/${ticketId}/chat`);
    await page.waitForLoadState('networkidle');

    // Either an empty-state "Start AI Analysis" button or the chat container
    const startBtn = page.getByRole('button', { name: /start ai analysis/i });
    const chatArea = page.locator('textarea');

    await expect(startBtn.or(chatArea)).toBeVisible({ timeout: 10_000 });
  });

  // ── 2. Starting a session ────────────────────────────────────────────────

  test('starts an agent session successfully', async ({ page }) => {
    const sessionRequests: { url: string; status: number; body: unknown }[] = [];

    // Capture POST /api/agent/sessions/:id
    page.on('response', async (res) => {
      if (res.url().includes('/api/agent/sessions') && res.request().method() === 'POST') {
        let body: unknown = null;
        try { body = await res.json(); } catch { /* non-JSON */ }
        sessionRequests.push({ url: res.url(), status: res.status(), body });
      }
    });

    await loginAndGoTo(page, '/dashboard/tickets');
    const ticketId = await getFirstTicketId(page);
    await page.goto(`/dashboard/tickets/${ticketId}/chat`);
    await page.waitForLoadState('networkidle');

    const startBtn = page.getByRole('button', { name: /start ai analysis/i });
    if (await startBtn.isVisible({ timeout: 5_000 })) {
      await startBtn.click();

      // Wait for the textarea to appear (session started → chat view)
      await expect(page.locator('textarea')).toBeVisible({ timeout: 15_000 });

      // Assert the POST succeeded
      expect(sessionRequests.length).toBeGreaterThan(0);
      const firstReq = sessionRequests[0]!;
      expect(firstReq.status).toBe(201);

      console.log('[session started]', JSON.stringify(firstReq.body, null, 2));
    } else {
      // Session already exists (seeded data) — just verify chat is shown
      await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── 3. Send a message — the key diagnostic test ──────────────────────────

  test('sends a message and receives a non-empty agent response', async ({ page }) => {
    const apiResponses: { endpoint: string; status: number; body: unknown }[] = [];

    // Intercept every agent API response
    page.on('response', async (res) => {
      if (res.url().includes('/api/agent/')) {
        let body: unknown = null;
        try { body = await res.json(); } catch { /* non-JSON */ }
        apiResponses.push({
          endpoint: `${res.request().method()} ${new URL(res.url()).pathname}`,
          status: res.status(),
          body,
        });
      }
    });

    await loginAndGoTo(page, '/dashboard/tickets');
    const ticketId = await getFirstTicketId(page);
    await page.goto(`/dashboard/tickets/${ticketId}/chat`);
    await page.waitForLoadState('networkidle');

    // Start session if needed
    const startBtn = page.getByRole('button', { name: /start ai analysis/i });
    if (await startBtn.isVisible({ timeout: 5_000 })) {
      await startBtn.click();
      await expect(page.locator('textarea')).toBeVisible({ timeout: 15_000 });
    }

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await expect(textarea).toBeEnabled();

    // Count existing messages before sending
    const messagesBefore = await page.locator('[data-testid="message-bubble"], .rounded-2xl').count();

    // Send a test message
    const testMessage = 'Can you help me understand what is causing this bug?';
    await textarea.fill(testMessage);

    // Verify char count updates
    await expect(page.getByText(`${testMessage.length}/2000`)).toBeVisible();

    // Send with Ctrl+Enter
    await textarea.press('Control+Enter');

    console.log('[message sent]', testMessage);

    // ── Wait for the typing indicator to appear then disappear ──
    const typingIndicator = page.locator('.animate-bounce').first();
    await typingIndicator.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {
      console.log('[warn] Typing indicator never appeared — agent may have responded instantly');
    });
    await typingIndicator.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {
      console.log('[warn] Typing indicator still visible after 30s — agent may be stuck');
    });

    // ── Assert new messages appeared ──
    await page.waitForFunction(
      (before) => {
        const bubbles = document.querySelectorAll('.rounded-2xl');
        return bubbles.length > before;
      },
      messagesBefore,
      { timeout: 30_000 },
    );

    // ── Check the last agent message is not empty ──
    const allBubbles = page.locator('.rounded-2xl');
    const count = await allBubbles.count();
    console.log(`[messages] Total bubbles after reply: ${count}`);

    // Find agent bubbles (gray background)
    const agentBubbles = page.locator('.bg-gray-100, .dark\\:bg-gray-800').filter({
      hasNot: page.locator('.animate-bounce'), // exclude typing indicator
    });

    const agentCount = await agentBubbles.count();
    console.log(`[messages] Agent message bubbles: ${agentCount}`);

    if (agentCount === 0) {
      // Dump all API responses to help diagnose
      console.error('[FAIL] No agent message bubbles found in DOM');
      console.error('[API responses captured]', JSON.stringify(apiResponses, null, 2));

      // Screenshot for debugging
      await page.screenshot({ path: 'test-results/agent-empty-response.png', fullPage: true });
    }

    expect(agentCount).toBeGreaterThan(0);

    // Check the last agent bubble is not empty
    const lastAgentBubble = agentBubbles.last();
    const responseText = await lastAgentBubble.textContent();
    console.log(`[agent response] "${responseText?.trim()}"`);

    expect(responseText?.trim()).toBeTruthy();
    expect(responseText?.trim().length).toBeGreaterThan(0);

    // Print all intercepted API responses for debugging
    console.log('[API responses]', JSON.stringify(apiResponses, null, 2));
  });

  // ── 4. REST fallback — send via HTTP when WebSocket unavailable ───────────

  test('REST fallback: POST /messages returns non-empty content field', async ({ page }) => {
    const messageApiLog: { status: number; body: unknown }[] = [];

    page.on('response', async (res) => {
      if (res.url().includes('/messages') && res.request().method() === 'POST') {
        let body: unknown = null;
        try { body = await res.json(); } catch { /* ignore */ }
        messageApiLog.push({ status: res.status(), body });
      }
    });

    await loginAndGoTo(page, '/dashboard/tickets');
    const ticketId = await getFirstTicketId(page);
    await page.goto(`/dashboard/tickets/${ticketId}/chat`);
    await page.waitForLoadState('networkidle');

    // Start session if needed
    const startBtn = page.getByRole('button', { name: /start ai analysis/i });
    if (await startBtn.isVisible({ timeout: 5_000 })) {
      await startBtn.click();
      await expect(page.locator('textarea')).toBeVisible({ timeout: 15_000 });
    }

    await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 });

    // Force offline socket by intercepting the socket.io handshake
    await page.route('**/socket.io/**', (route) => route.abort());

    // Wait a bit for the "Reconnecting…" indicator to appear
    await page.waitForTimeout(2_000);

    // Send via the now-fallback REST path
    await page.locator('textarea').fill('Hello, please respond.');
    await page.locator('textarea').press('Control+Enter');

    // Wait for a response
    await page.waitForTimeout(10_000);

    console.log('[REST /messages responses]', JSON.stringify(messageApiLog, null, 2));

    if (messageApiLog.length > 0) {
      const last = messageApiLog[messageApiLog.length - 1]!;
      expect(last.status).toBe(201);

      // The critical assertion: content must not be empty
      const body = last.body as { content?: string } | null;
      console.log('[REST response body]', JSON.stringify(body, null, 2));
      expect(body?.content).toBeTruthy();
      expect(body?.content?.trim().length).toBeGreaterThan(0);
    } else {
      console.log('[info] No REST /messages call made — WebSocket was used instead');
    }
  });

  // ── 5. API direct probe — calls the messages endpoint directly ────────────

  test('API probe: direct POST to /api/agent/sessions/:id/messages returns non-empty content', async ({ page, request }) => {
    // Step 1: get a JWT token by logging in via the API
    const loginRes = await request.post(`http://localhost:3001/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });

    if (!loginRes.ok()) {
      console.warn('[skip] Could not login via API — is the API running on :3001?');
      test.skip(true, 'API not reachable');
      return;
    }

    const { accessToken } = await loginRes.json();

    // Step 2: get first ticket
    const ticketsRes = await request.get(`http://localhost:3001/api/tickets?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ticketsData = await ticketsRes.json();
    const tickets = ticketsData.data ?? ticketsData.tickets ?? ticketsData;
    const ticket = Array.isArray(tickets) ? tickets[0] : null;

    if (!ticket) {
      console.warn('[skip] No tickets found — run pnpm db:seed first');
      test.skip(true, 'No tickets in DB');
      return;
    }

    const ticketId = ticket.id as string;
    console.log('[probe] Using ticket:', ticketId, ticket.title);

    // Step 3: start (or reuse) an agent session
    const sessionRes = await request.post(
      `http://localhost:3001/api/agent/sessions/${ticketId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const sessionBody = await sessionRes.json();
    console.log('[probe] Session response status:', sessionRes.status());
    console.log('[probe] Session body:', JSON.stringify(sessionBody, null, 2));

    const sessionId = sessionBody.id as string;
    expect(sessionId).toBeTruthy();

    // Step 4: send a message directly
    const msgRes = await request.post(
      `http://localhost:3001/api/agent/sessions/${sessionId}/messages`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { content: 'What is the root cause of this issue?' },
      },
    );

    const msgBody = await msgRes.json() as { content?: string; role?: string } | null;
    console.log('[probe] Message POST status:', msgRes.status());
    console.log('[probe] Message response body:', JSON.stringify(msgBody, null, 2));

    // ── THE KEY ASSERTION: content must not be empty ──
    expect(msgRes.status()).toBe(201);
    expect(msgBody).toBeTruthy();
    expect(msgBody?.role).toBe('agent');
    expect(msgBody?.content).toBeTruthy();
    expect(msgBody?.content?.trim().length).toBeGreaterThan(0);
  });

  // ── 6. Escalation flow ───────────────────────────────────────────────────

  test('typing "speak to a human" triggers escalation state', async ({ page }) => {
    await loginAndGoTo(page, '/dashboard/tickets');
    const ticketId = await getFirstTicketId(page);
    await page.goto(`/dashboard/tickets/${ticketId}/chat`);
    await page.waitForLoadState('networkidle');

    // Start session if needed
    const startBtn = page.getByRole('button', { name: /start ai analysis/i });
    if (await startBtn.isVisible({ timeout: 5_000 })) {
      await startBtn.click();
      await expect(page.locator('textarea')).toBeVisible({ timeout: 15_000 });
    }

    const textarea = page.locator('textarea');
    await expect(textarea).toBeEnabled({ timeout: 10_000 });

    await textarea.fill('I want to speak to a human agent please.');
    await textarea.press('Control+Enter');

    // Wait up to 30s for escalation banner or disabled textarea
    await expect(
      page.getByText(/escalated|human support|speak to a human/i)
        .or(page.locator('textarea[disabled]'))
    ).toBeVisible({ timeout: 30_000 });

    console.log('[escalation] Escalation state reached successfully');
  });
});
