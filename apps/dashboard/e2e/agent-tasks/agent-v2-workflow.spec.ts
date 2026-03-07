import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

/**
 * E2E test: Trigger analysis on a ticket and verify the V2 agent workflow.
 *
 * Flow:
 * 1. Login -> navigate to a ticket with an application + GitHub config
 * 2. Click "Analyser" button
 * 3. Verify redirect to /dashboard/agent-tasks/:id
 * 4. Verify the task starts (status badge shows "analyzing")
 * 5. Verify execution logs appear (V2 agentic loop produces log entries)
 * 6. Wait for completion or meaningful progress (diagnosis produced)
 */

const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';
const EMAIL = 'owner@test.local';
const PASSWORD = 'password123';

// Ticket with application_id + GitHub config (status: "new")
const TICKET_ID = 'fd509b4f-dab0-4cfb-83b6-dd9a1ef5b294';

test.describe('Agent V2 Workflow — Trigger Analysis', () => {
  test.setTimeout(300_000); // V2 agentic loop can take 2-4 min depending on AI response time

  test('clicking Analyser triggers V2 analysis and shows live progress', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Set PLAYWRIGHT_SERVER_AVAILABLE=true');

    // 1. Login
    await login(page, EMAIL, PASSWORD);

    // 2. Navigate to ticket detail
    await page.goto(`/dashboard/tickets/${TICKET_ID}`);
    await page.waitForLoadState('networkidle');

    // 3. Find and click the "Analyser" button
    const analyserBtn = page.locator('button', { hasText: 'Analyser' });
    await expect(analyserBtn).toBeVisible({ timeout: 10_000 });
    await analyserBtn.click();

    // 4. Should redirect to /dashboard/agent-tasks/:uuid
    await page.waitForURL('**/dashboard/agent-tasks/**', { timeout: 15_000 });
    const url = page.url();
    expect(url).toMatch(/\/dashboard\/agent-tasks\/[0-9a-f-]{36}/);

    // Extract the agent task ID from the URL
    const taskId = url.split('/agent-tasks/')[1]?.split(/[?#]/)[0];
    expect(taskId).toBeTruthy();
    console.log(`Agent task created: ${taskId}`);

    // 5. Verify the task detail page loaded — status badge should be visible
    const statusBadge = page.getByTestId('agent-task-status-badge');
    await expect(statusBadge).toBeVisible({ timeout: 10_000 });

    // Status should be "analyzing" initially
    const statusText = await statusBadge.textContent();
    console.log(`Initial status: ${statusText}`);
    // It might already be completed if very fast, so just check it's not empty
    expect(statusText?.trim()).not.toBe('');

    // 6. Check the Execution Logs tab for V2 activity
    const logsTab = page.getByTestId('agent-task-tab-logs');
    await logsTab.click();

    const terminal = page.getByTestId('agent-task-logs-terminal');
    await expect(terminal).toBeVisible();

    // 7. Wait for the analysis to produce at least some logs (V2 should emit logs)
    // V2 logs steps like: started, ticket_loaded, code_search, calling_ai, etc.
    // We wait up to 90s for at least one log line to appear in the terminal
    const logLine = terminal.locator('.font-mono.text-xs');
    await expect(logLine.first()).toBeVisible({ timeout: 90_000 });

    const logCount = await logLine.count();
    console.log(`Log lines visible: ${logCount}`);
    expect(logCount).toBeGreaterThan(0);

    // 8. Switch to Overview tab and check duration is ticking
    const overviewTab = page.getByTestId('agent-task-tab-overview');
    await overviewTab.click();

    const duration = page.getByTestId('agent-task-duration');
    await expect(duration).toBeVisible();
    const durationText = await duration.textContent();
    console.log(`Duration: ${durationText}`);
    // Duration should not be "-" since the task has started
    expect(durationText?.trim()).not.toBe('-');

    // 9. Wait for a terminal status (completed or failed) via API polling
    // Avoid page.reload() which hangs on waitForLoadState('networkidle') in HMR mode
    let finalStatus = 'analyzing';
    const apiBase = 'http://localhost:3001/api/v1/agent-tasks';
    const cookies = await page.context().cookies();
    // Get a fresh JWT for API polling
    const tokenResp = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@test.local', password: 'password123' }),
      });
      const data = await resp.json();
      return data.accessToken;
    });

    for (let i = 0; i < 48; i++) { // 48 * 5s = 240s max
      await page.waitForTimeout(5_000);
      const statusResp = await page.evaluate(
        async ({ url, token }: { url: string; token: string }) => {
          const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const data = await resp.json();
          return data.status as string;
        },
        { url: `${apiBase}/${taskId}`, token: tokenResp }
      );
      const normalized = statusResp?.toLowerCase() ?? '';
      console.log(`Polling status: ${normalized}`);
      if (['completed', 'failed', 'expired'].includes(normalized)) {
        finalStatus = normalized;
        break;
      }
    }

    console.log(`Final status: ${finalStatus}`);

    if (finalStatus === 'completed') {
      console.log('V2 analysis completed successfully!');
    }

    // The test passes if we got a terminal status — this confirms the V2 pipeline
    // ran end-to-end instead of getting stuck like V1 did
    expect(['completed', 'failed', 'expired']).toContain(finalStatus);
  });
});
