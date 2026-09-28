import { test, Page } from '@playwright/test';

// ─── Utility Functions ───────────────────────────────────────────────────────

let sectionCounter = 0;
const TOTAL_SECTIONS = 18;

/** Display a gradient annotation banner at the top of the page with section counter and subtitle */
async function showAnnotation(page: Page, title: string, subtitle?: string) {
  await page.evaluate(
    ({ msg, sub, counter, total }) => {
      const existing = document.getElementById('demo-annotation');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.id = 'demo-annotation';

      const counterEl = document.createElement('div');
      counterEl.textContent = `${counter}/${total}`;
      Object.assign(counterEl.style, {
        position: 'absolute',
        top: '8px',
        right: '16px',
        fontSize: '12px',
        fontWeight: '600',
        opacity: '0.7',
        fontFamily: 'system-ui, sans-serif',
      });

      const titleEl = document.createElement('div');
      titleEl.textContent = msg;
      Object.assign(titleEl.style, {
        fontSize: '18px',
        fontWeight: '700',
        lineHeight: '1.2',
      });

      banner.appendChild(counterEl);
      banner.appendChild(titleEl);

      if (sub) {
        const subEl = document.createElement('div');
        subEl.textContent = sub;
        Object.assign(subEl.style, {
          fontSize: '13px',
          fontWeight: '400',
          opacity: '0.85',
          marginTop: '2px',
        });
        banner.appendChild(subEl);
      }

      Object.assign(banner.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        zIndex: '99999',
        padding: '10px 24px',
        paddingRight: '60px',
        background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'left',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        letterSpacing: '0.3px',
        pointerEvents: 'none',
      });

      document.body.prepend(banner);
    },
    { msg: title, sub: subtitle, counter: sectionCounter, total: TOTAL_SECTIONS }
  );
  await pause(page, 800);
}

/** Highlight an element with an amber border (visual only, uses CSS selector) */
async function highlight(page: Page, selector: string, durationMs = 3000) {
  try {
    await page.evaluate(
      ({ sel, dur }) => {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement) {
          const prev = { outline: el.style.outline, outlineOffset: el.style.outlineOffset };
          el.style.outline = '3px solid #f59e0b';
          el.style.outlineOffset = '3px';
          el.style.transition = 'outline 0.2s ease';
          setTimeout(() => {
            el.style.outline = prev.outline;
            el.style.outlineOffset = prev.outlineOffset;
          }, dur);
        }
      },
      { sel: selector, dur: durationMs }
    );
  } catch {
    // Element not found — skip silently
  }
}

/** Pause for a given duration */
async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

/** Smooth scroll to a Y position */
async function scrollTo(page: Page, y: number) {
  await page.evaluate(pos => window.scrollTo({ top: pos, behavior: 'smooth' }), y);
  await pause(page, 800);
}

/** Wrap a section in try/catch so the tour continues even if one section fails */
async function safeSection(name: string, fn: () => Promise<void>) {
  sectionCounter++;
  try {
    await fn();
  } catch (error) {
    console.warn(`[DEMO] Section "${name}" failed:`, error);
  }
}

// ─── Full Platform Demo ───────────────────────────────────────────────────────

test('Support Helper Platform — Full Demo (~8 min)', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);

  // ━━━ 1/18 LOGIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('1/18 - Login', async () => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await showAnnotation(page, 'Login — Support Helper', 'Authenticate with owner credentials');

    await highlight(page, 'form', 1500);
    await pause(page, 600);

    // Wait for React hydration
    const emailInput = page.locator('#email');
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });

    await emailInput.click();
    await emailInput.fill('owner@test.local');
    await pause(page, 400);

    await page.locator('#password').click();
    await page.locator('#password').fill('password123');
    await pause(page, 400);

    await highlight(page, 'button[type="submit"]', 2000);
    await pause(page, 600);

    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    await pause(page, 1200);
  });

  // ━━━ 2/18 DASHBOARD HOME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('2/18 - Dashboard Home', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Dashboard Home',
      'KPIs at a glance: open tickets, critical issues, resolution rate'
    );

    // Highlight the welcome heading
    await highlight(page, 'h1', 2000);
    await pause(page, 1000);

    // Highlight the KPI grid
    await highlight(page, '.grid', 2500);
    await pause(page, 1500);

    // Scroll down to recent tickets
    await scrollTo(page, 350);
    await pause(page, 1000);

    // Scroll down to quick access cards
    await scrollTo(page, 700);
    await pause(page, 1200);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 3/18 APPLICATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('3/18 - Applications', async () => {
    await page.goto('/dashboard/applications');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Applications & SDK Keys',
      'Manage apps, view SDK keys, create new integrations'
    );

    // Show existing app cards
    await highlight(page, '.grid', 2000);
    await pause(page, 1500);

    // Highlight the "Nouvelle application" button
    const newAppButton = page.locator('button', { hasText: /nouvelle application/i });
    if (await newAppButton.isVisible()) {
      await highlight(page, 'button', 1500);
      await pause(page, 600);

      // Open the create modal
      await newAppButton.click();
      await pause(page, 1200);

      // Fill in the modal form
      const nameInput = page.locator('[role="dialog"] input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Demo App');
        await pause(page, 600);

        // Fill description if present
        const descInput = page.locator('[role="dialog"] textarea').first();
        if (await descInput.isVisible()) {
          await descInput.fill('Demo application created during the platform tour');
          await pause(page, 600);
        }

        // Highlight the form before submitting
        await highlight(page, '[role="dialog"]', 2000);
        await pause(page, 800);

        // Submit the form
        const submitBtn = page
          .locator('[role="dialog"] button[type="submit"]')
          .or(
            page.locator('[role="dialog"] button', { hasText: /créer|create|enregistrer|save/i })
          );
        if (await submitBtn.first().isVisible()) {
          await submitBtn.first().click();
          await pause(page, 2000);
        } else {
          // Close without submitting
          await page.keyboard.press('Escape');
          await pause(page, 800);
        }
      } else {
        await page.keyboard.press('Escape');
        await pause(page, 800);
      }
    }

    // Show the updated application list
    await highlight(page, '.grid', 2000);
    await pause(page, 1500);
  });

  // ━━━ 4/18 AI SETTINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('4/18 - AI Settings', async () => {
    await page.goto('/dashboard/settings/ai');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'AI Configuration',
      'Choose your AI provider: Anthropic, OpenAI, Gemini, Bedrock or Ollama'
    );

    // Highlight the provider selection area
    await highlight(page, 'h1', 1500);
    await pause(page, 800);

    // Highlight provider cards/selectors
    await highlight(page, '.grid', 2500);
    await pause(page, 1500);

    // Scroll to model selector and advanced options
    await scrollTo(page, 400);
    await pause(page, 1200);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 5/18 AI BEHAVIOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('5/18 - AI Behavior', async () => {
    // Try agent behavior settings if the page exists
    await page.goto('/dashboard/settings/agent');
    await pause(page, 1000);

    const notFound =
      page.url().includes('404') ||
      page.url().includes('not-found') ||
      (await page.locator('h1', { hasText: /404|not found/i }).isVisible());

    if (notFound) {
      // Fall back to general settings
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');
      await showAnnotation(
        page,
        'Settings — Profile & Security',
        'Account management, security, notifications, and team settings'
      );
    } else {
      await page.waitForLoadState('networkidle');
      await showAnnotation(
        page,
        'AI Behavior Settings',
        'Configure agent mode, complexity thresholds, and auto-analysis rules'
      );
    }

    await highlight(page, 'h1', 1500);
    await pause(page, 1000);

    await scrollTo(page, 400);
    await pause(page, 1200);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 6/18 INTEGRATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('6/18 - Integrations', async () => {
    await page.goto('/dashboard/integrations');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Integrations',
      'Connect Jira, Slack, HubSpot and more — bi-directional ticket sync'
    );

    // Highlight the stats cards
    await highlight(page, '.grid', 2000);
    await pause(page, 1200);

    // Highlight type filter chips
    await highlight(page, '.rounded-xl.border', 1500);
    await pause(page, 800);

    // Scroll through integration cards
    await scrollTo(page, 400);
    await pause(page, 1000);

    await scrollTo(page, 800);
    await pause(page, 1200);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 7/18 GITHUB INTEGRATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('7/18 - GitHub Integration', async () => {
    await page.goto('/dashboard/github');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'GitHub Integration',
      'OAuth connection, installed repos, and AI-powered user story generation'
    );

    // Highlight the connection status card
    await highlight(page, 'h1', 1500);
    await pause(page, 800);

    // Highlight connection status section
    await highlight(page, '.rounded-lg', 2000);
    await pause(page, 1200);

    // Scroll down to show repos
    await scrollTo(page, 400);
    await pause(page, 1200);

    await scrollTo(page, 800);
    await pause(page, 1000);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 8/18 SDK DEMO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('8/18 - SDK Demo', async () => {
    await page.goto('/dashboard/sdk-demo');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'SDK Widget Demo',
      'Test the embeddable support widget live — configure, launch, and capture events'
    );

    // Highlight the configuration panel
    await highlight(page, 'h2', 1500);
    await pause(page, 800);

    // Highlight SDK key input
    await highlight(page, '#sdk-key', 2000);
    await pause(page, 1000);

    // Highlight the color picker
    await highlight(page, '#primary-color', 1500);
    await pause(page, 800);

    // Highlight position and theme selects
    await highlight(page, '#position', 1500);
    await pause(page, 600);

    // Click the Launch button
    const launchButton = page.locator('button', { hasText: /lancer|launch/i });
    if (await launchButton.isVisible()) {
      await highlight(page, 'button', 1500);
      await pause(page, 600);
      await launchButton.click();
      await pause(page, 2500);

      // Show the event log
      await highlight(page, '.divide-y', 2000);
      await pause(page, 1500);

      // Stop the widget
      const stopButton = page.locator('button', { hasText: /arrêter|arreter|stop/i });
      if (await stopButton.isVisible()) {
        await stopButton.click();
        await pause(page, 1000);
      }
    }
  });

  // ━━━ 9/18 TICKETS LIST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('9/18 - Tickets List', async () => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Tickets',
      'Search, filter by status/severity, toggle table or grid view, bulk actions'
    );

    // Highlight the filter bar
    await highlight(page, '.mb-6 .bg-white', 2000);
    await pause(page, 1200);

    // Highlight the stats bar (real-time indicator)
    await highlight(page, '.bg-white.dark\\:bg-gray-900.p-4', 1500);
    await pause(page, 800);

    // Try toggling to grid view
    const gridButton = page.locator('button[aria-label*="grille"], button[aria-label*="grid" i]');
    if (await gridButton.first().isVisible()) {
      await gridButton.first().click();
      await pause(page, 1500);

      // Switch back to table
      const tableButton = page.locator('button[aria-label*="table" i]');
      if (await tableButton.first().isVisible()) {
        await tableButton.first().click();
        await pause(page, 1000);
      }
    }

    // Highlight the tickets table
    await highlight(page, 'table', 2000);
    await pause(page, 1200);

    // Scroll down to see more tickets
    await scrollTo(page, 400);
    await pause(page, 1000);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 10/18 TICKET DETAIL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('10/18 - Ticket Detail', async () => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');

    // Click the first ticket row to navigate to detail
    const firstTicketLink = page.locator('a[href*="/dashboard/tickets/"]').first();
    if (await firstTicketLink.isVisible({ timeout: 8000 })) {
      await firstTicketLink.click();
      await page.waitForLoadState('networkidle');
      await pause(page, 1000);

      await showAnnotation(
        page,
        'Ticket Detail — Immersive Split Layout',
        'Left: ticket info, description, context, recording — Right: AI diagnosis + chat'
      );

      // Highlight the top bar header
      await highlight(page, 'header', 2000);
      await pause(page, 1200);

      // Highlight the left pane
      await highlight(page, '.flex-1.overflow-y-auto', 2000);
      await pause(page, 1200);

      // Highlight the right AI pane
      await highlight(page, '.w-\\[460px\\]', 2500);
      await pause(page, 1500);

      // Scroll the left pane to show description and context
      await page.evaluate(() => {
        const leftPane = document.querySelector('.flex-1.overflow-y-auto');
        if (leftPane) leftPane.scrollTo({ top: 300, behavior: 'smooth' });
      });
      await pause(page, 1200);

      await page.evaluate(() => {
        const leftPane = document.querySelector('.flex-1.overflow-y-auto');
        if (leftPane) leftPane.scrollTo({ top: 0, behavior: 'smooth' });
      });
      await pause(page, 500);
    }
  });

  // ━━━ 11/18 STATUS MANAGEMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('11/18 - Status Management', async () => {
    // We should already be on a ticket detail page
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard/tickets/')) {
      // Navigate to first ticket
      await page.goto('/dashboard/tickets');
      await page.waitForLoadState('networkidle');
      const firstLink = page.locator('a[href*="/dashboard/tickets/"]').first();
      if (await firstLink.isVisible({ timeout: 8000 })) {
        await firstLink.click();
        await page.waitForLoadState('networkidle');
        await pause(page, 800);
      }
    }

    await showAnnotation(
      page,
      'Status Management',
      'One-click status change with instant optimistic update and toast notification'
    );

    // Highlight the status dropdown
    const statusSelect = page.getByRole('combobox', { name: /status|statut/i });
    if (await statusSelect.isVisible({ timeout: 5000 })) {
      await highlight(page, 'select[aria-label]', 2500);
      await pause(page, 1000);

      // Change status to "in_progress" or similar
      const currentStatus = await statusSelect.inputValue();
      const newStatus = currentStatus === 'open' ? 'in_progress' : 'open';
      await statusSelect.selectOption(newStatus);
      await pause(page, 2000);

      // Show the toast notification that appeared
      await highlight(page, '[role="alert"], .toast, [data-toast]', 1500);
      await pause(page, 1500);
    }
  });

  // ━━━ 12/18 TRIGGER AGENT ANALYSIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('12/18 - Trigger Agent Analysis', async () => {
    await showAnnotation(
      page,
      'Trigger AI Agent Analysis',
      'One click to launch the V2 agentic loop — autonomously reads code and creates a PR'
    );

    // Remove annotation before clicking to avoid pointer interception
    await page.evaluate(() => {
      const ann = document.getElementById('demo-annotation');
      if (ann) ann.remove();
    });

    // Highlight the Analyser button in the top bar
    const analyserBtn = page.locator('button', { hasText: /analyser|analyze/i });
    if (await analyserBtn.isVisible({ timeout: 5000 })) {
      await highlight(page, 'header button', 2500);
      await pause(page, 1500);

      // Click Analyser to trigger V2 analysis (with explicit timeout to avoid consuming test timeout)
      await analyserBtn.click({ timeout: 10_000 });

      // Wait for redirect to agent task page
      const redirected = await Promise.race([
        page
          .waitForURL('**/dashboard/agent-tasks/**', { timeout: 15_000 })
          .then(() => true)
          .catch(() => false),
        pause(page, 15_000).then(() => false),
      ]);

      if (redirected) {
        await pause(page, 1500);
        await showAnnotation(
          page,
          'Agent Task Created!',
          'Redirected to live agent task — real-time logs and status updates via WebSocket'
        );
        await pause(page, 2000);
      }
    } else {
      // Graceful skip — no Analyser button visible
      console.log('[DEMO] Analyser button not found — skipping agent trigger');
      await showAnnotation(
        page,
        'Agent Analysis (skipped)',
        'Analyser button not visible on this ticket — showing agent tasks list instead'
      );
      await pause(page, 1500);
    }
  });

  // ━━━ 13/18 AGENT TASK DETAIL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('13/18 - Agent Task Detail', async () => {
    // If not on agent task detail, navigate to the first available task
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard/agent-tasks/')) {
      await page.goto('/dashboard/agent-tasks');
      await page.waitForLoadState('networkidle');
      await pause(page, 800);

      const firstTaskLink = page
        .locator('a[href*="/dashboard/agent-tasks/"]')
        .filter({ hasNot: page.locator('h1') })
        .first();
      if (await firstTaskLink.isVisible({ timeout: 5000 })) {
        await firstTaskLink.click();
        await page.waitForLoadState('networkidle');
        await pause(page, 1000);
      }
    }

    await showAnnotation(
      page,
      'Agent Task Detail',
      'Tabbed view: Overview, Execution Logs, Timeline, Diagnosis — live updates'
    );

    // Highlight the status badge
    const statusBadge = page.getByTestId('agent-task-status-badge');
    if (await statusBadge.isVisible({ timeout: 5000 })) {
      await highlight(page, '[data-testid="agent-task-status-badge"]', 2000);
      await pause(page, 1000);
    }

    // Click the Logs tab
    const logsTab = page.getByTestId('agent-task-tab-logs');
    if (await logsTab.isVisible({ timeout: 5000 })) {
      await logsTab.click();
      await pause(page, 1200);

      // Highlight the terminal/logs output
      const terminal = page.getByTestId('agent-task-logs-terminal');
      if (await terminal.isVisible({ timeout: 5000 })) {
        await highlight(page, '[data-testid="agent-task-logs-terminal"]', 2500);
        await pause(page, 1500);
      }
    }

    // Click the Overview tab
    const overviewTab = page.getByTestId('agent-task-tab-overview');
    if (await overviewTab.isVisible({ timeout: 5000 })) {
      await overviewTab.click();
      await pause(page, 1000);
    }

    // Try Timeline tab
    const timelineTab = page
      .locator('[data-testid="agent-task-tab-timeline"]')
      .or(page.locator('button', { hasText: /timeline|chronologie/i }));
    if (await timelineTab.first().isVisible({ timeout: 3000 })) {
      await timelineTab.first().click();
      await pause(page, 1200);
    }

    // Try Diagnosis tab
    const diagnosisTab = page
      .locator('[data-testid="agent-task-tab-diagnosis"]')
      .or(page.locator('button', { hasText: /diagnosis|diagnostic/i }));
    if (await diagnosisTab.first().isVisible({ timeout: 3000 })) {
      await diagnosisTab.first().click();
      await pause(page, 1500);

      await scrollTo(page, 400);
      await pause(page, 1000);
      await scrollTo(page, 0);
      await pause(page, 500);
    }
  });

  // ━━━ 14/18 AGENT TASKS LIST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('14/18 - Agent Tasks List', async () => {
    await page.goto('/dashboard/agent-tasks');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Agent Tasks — Monitoring',
      'Real-time task list: metrics cards, status filters, live green dot indicator'
    );

    // Highlight the metrics cards
    await highlight(page, '.mb-6:first-of-type', 2500);
    await pause(page, 1500);

    // Highlight the live indicator
    await highlight(page, '.animate-ping', 2000);
    await pause(page, 1000);

    // Highlight the filters bar
    await highlight(page, '.mb-6 + .mb-6', 1500);
    await pause(page, 800);

    // Highlight the tasks table
    await highlight(page, 'table, .bg-white.dark\\:bg-gray-900.rounded-lg', 2000);
    await pause(page, 1500);

    await scrollTo(page, 400);
    await pause(page, 1000);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 15/18 ANALYTICS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('15/18 - Analytics', async () => {
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Analytics Dashboard',
      'KPIs, status/severity/type charts, resolution trends, and AI triage metrics'
    );

    // Highlight the time range selector
    await highlight(page, 'select', 1500);
    await pause(page, 800);

    // Highlight the KPI cards row
    await highlight(page, '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4', 2500);
    await pause(page, 1500);

    // Scroll through all charts
    await scrollTo(page, 400);
    await pause(page, 1200);

    await scrollTo(page, 800);
    await pause(page, 1200);

    await scrollTo(page, 1200);
    await pause(page, 1200);

    await scrollTo(page, 1600);
    await pause(page, 1000);

    await scrollTo(page, 2000);
    await pause(page, 1200);

    await scrollTo(page, 0);
    await pause(page, 500);
  });

  // ━━━ 16/18 SETTINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('16/18 - Settings', async () => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Settings',
      'Profile, Security (2FA), Notifications, and Team management'
    );

    // Profile tab (default)
    await highlight(page, 'form', 2000);
    await pause(page, 1200);

    // Click Security tab
    const securityTab = page
      .locator('button', { hasText: /securit/i })
      .or(page.locator('button', { hasText: /sécurit/i }));
    if (await securityTab.first().isVisible({ timeout: 3000 })) {
      await securityTab.first().click();
      await pause(page, 1200);
      await highlight(page, 'form, .space-y-4', 1500);
      await pause(page, 800);
    }

    // Click Notifications tab
    const notifTab = page.locator('button', { hasText: /notif/i });
    if (await notifTab.first().isVisible({ timeout: 3000 })) {
      await notifTab.first().click();
      await pause(page, 1200);
      await highlight(page, 'form, .space-y-4', 1500);
      await pause(page, 800);
    }

    // Click Team tab
    const teamTab = page
      .locator('button', { hasText: /quipe/i })
      .or(page.locator('button', { hasText: /team/i }));
    if (await teamTab.first().isVisible({ timeout: 3000 })) {
      await teamTab.first().click();
      await pause(page, 1200);
      await highlight(page, 'table, .space-y-4', 1500);
      await pause(page, 800);
    }

    // Return to Profile
    const profileTab = page.locator('button', { hasText: /profil/i });
    if (await profileTab.first().isVisible({ timeout: 3000 })) {
      await profileTab.first().click();
      await pause(page, 800);
    }
  });

  // ━━━ 17/18 DARK MODE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('17/18 - Dark Mode', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Dark Mode',
      'Toggle between light, dark, and system themes — persisted across sessions'
    );

    // Find and click the theme toggle button
    const themeButton = page
      .locator('button[aria-label*="hème"]')
      .or(page.locator('button[aria-label*="theme" i]'))
      .or(page.locator('button[aria-label*="Changer" i]'));

    if (await themeButton.first().isVisible({ timeout: 5000 })) {
      await highlight(page, 'button[aria-label*="hème"], button[aria-label*="theme" i]', 2000);
      await pause(page, 800);

      // Toggle to dark mode
      await themeButton.first().click();
      await pause(page, 2000);

      // Show dark mode on dashboard
      await scrollTo(page, 350);
      await pause(page, 1500);

      await scrollTo(page, 0);
      await pause(page, 1000);

      // Toggle back to light
      await themeButton.first().click();
      await pause(page, 1500);
    } else {
      await pause(page, 1000);
    }
  });

  // ━━━ 18/18 DEMO COMPLETE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('18/18 - Demo Complete', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await showAnnotation(
      page,
      'Support Helper Platform — Demo Complete',
      'AI-powered support platform: SDK capture, agent analysis, GitHub PR generation'
    );

    // Final highlight of the dashboard
    await highlight(page, '.max-w-7xl', 2500);
    await pause(page, 3000);
  });
});
