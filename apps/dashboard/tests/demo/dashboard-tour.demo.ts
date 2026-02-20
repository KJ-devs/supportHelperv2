import { test, Page } from '@playwright/test';

// ─── Utility Functions ───────────────────────────────────────────────

/** Display a blue annotation banner at the top of the page */
async function showAnnotation(page: Page, text: string) {
  await page.evaluate((msg) => {
    const existing = document.getElementById('demo-annotation');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'demo-annotation';
    banner.textContent = msg;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: '99999',
      padding: '12px 24px',
      background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
      color: 'white',
      fontSize: '18px',
      fontWeight: '700',
      fontFamily: 'system-ui, sans-serif',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      letterSpacing: '0.5px',
    });
    document.body.prepend(banner);
  }, text);
  await pause(page, 800);
}

/** Highlight an element with a colored border */
async function highlight(page: Page, selector: string) {
  try {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) {
        el.style.outline = '3px solid #f59e0b';
        el.style.outlineOffset = '2px';
        el.style.transition = 'outline 0.3s ease';
        setTimeout(() => {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }, 3000);
      }
    }, selector);
  } catch {
    // Element not found, skip
  }
}

/** Pause for a given duration */
async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

/** Wrap a section in try/catch so the tour continues even if one section fails */
async function safeSection(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    console.warn(`[DEMO] Section "${name}" failed:`, error);
  }
}

// ─── Demo Tour Test ──────────────────────────────────────────────────

test('Dashboard Demo Tour - Full Feature Walkthrough', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);

  // ━━━ 1/11 LOGIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('1/11 - Login', async () => {
    await page.goto('/login');
    await showAnnotation(page, '1/11 - Login');

    await highlight(page, 'form');
    await pause(page, 500);

    // Fill credentials
    await page.fill('#email', 'owner@test.local');
    await pause(page, 300);
    await page.fill('#password', 'password123');
    await pause(page, 300);

    // Highlight the sign-in button
    await highlight(page, 'button[type="submit"]');
    await pause(page, 500);

    // Click sign in
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await pause(page, 1000);
  });

  // ━━━ 2/11 DASHBOARD HOME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('2/11 - Dashboard Home', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '2/11 - Dashboard Home');

    // Highlight welcome message
    await highlight(page, 'h1');
    await pause(page, 1000);

    // Highlight quick links cards
    await highlight(page, '.grid');
    await pause(page, 1500);

    // Scroll down to see all content
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await pause(page, 1000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 500);
  });

  // ━━━ 3/11 TICKETS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('3/11 - Tickets', async () => {
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '3/11 - Tickets');
    await pause(page, 1500);

    // Highlight the ticket stats bar
    await highlight(page, '.shadow');
    await pause(page, 1000);

    // Try toggling to grid view
    const gridButton = page.locator('button[aria-label="Vue grille"]');
    if (await gridButton.isVisible()) {
      await highlight(page, 'button[aria-label="Vue grille"]');
      await pause(page, 500);
      await gridButton.click();
      await pause(page, 1500);

      // Switch back to table
      const tableButton = page.locator('button[aria-label="Vue table"]');
      if (await tableButton.isVisible()) {
        await tableButton.click();
        await pause(page, 1000);
      }
    }

    // Try clicking on the first ticket row
    const firstTicketRow = page.locator('table tbody tr').first();
    if (await firstTicketRow.isVisible()) {
      await highlight(page, 'table tbody tr:first-child');
      await pause(page, 500);
      await firstTicketRow.click();
      await pause(page, 2000);

      // Go back to tickets list
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await pause(page, 500);
    }
  });

  // ━━━ 4/11 AGENT TASKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('4/11 - Agent Tasks', async () => {
    await page.goto('/dashboard/agent-tasks');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '4/11 - Agent Tasks');
    await pause(page, 1500);

    // Highlight metrics cards
    await highlight(page, '.grid');
    await pause(page, 1500);

    // Scroll to see the tasks table
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 500);
  });

  // ━━━ 5/11 APPLICATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('5/11 - Applications', async () => {
    await page.goto('/dashboard/applications');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '5/11 - Applications');
    await pause(page, 1500);

    // Highlight the "Nouvelle application" button
    const newAppButton = page.locator('button', { hasText: 'Nouvelle application' });
    if (await newAppButton.isVisible()) {
      await highlight(page, 'button');
      await pause(page, 500);

      // Open the modal
      await newAppButton.click();
      await pause(page, 1500);

      // Close the modal
      const closeButton = page.locator('[role="dialog"] button', { hasText: /close|fermer|annuler|cancel/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await pause(page, 800);
    }

    // Show existing application cards
    await highlight(page, '.grid');
    await pause(page, 1000);
  });

  // ━━━ 6/11 INTEGRATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('6/11 - Integrations', async () => {
    await page.goto('/dashboard/integrations');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '6/11 - Integrations');
    await pause(page, 1500);

    // Highlight the gradient hero header
    await highlight(page, '.bg-gradient-to-br');
    await pause(page, 1000);

    // Scroll to see cards/content
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 500);
  });

  // ━━━ 7/11 GITHUB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('7/11 - GitHub', async () => {
    await page.goto('/dashboard/github');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '7/11 - GitHub Integration');
    await pause(page, 1500);

    // Highlight the connection status card
    await highlight(page, '.mb-6:last-of-type');
    await pause(page, 1000);

    // Scroll to see full page
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 500);
  });

  // ━━━ 8/11 ANALYTICS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('8/11 - Analytics', async () => {
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '8/11 - Analytics');
    await pause(page, 1500);

    // Highlight metrics cards
    await highlight(page, '.grid');
    await pause(page, 1000);

    // Scroll through the charts
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 500);
  });

  // ━━━ 9/11 SETTINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('9/11 - Settings', async () => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '9/11 - Settings');
    await pause(page, 1500);

    // Profile tab (already active by default)
    await highlight(page, 'form');
    await pause(page, 1000);

    // Click Security tab
    const securityTab = page.locator('button', { hasText: 'Securite' }).or(
      page.locator('button', { hasText: 'curit' })
    );
    if (await securityTab.first().isVisible()) {
      await securityTab.first().click();
      await pause(page, 1200);
    }

    // Click Notifications tab
    const notifTab = page.locator('button', { hasText: 'Notification' });
    if (await notifTab.first().isVisible()) {
      await notifTab.first().click();
      await pause(page, 1200);
    }

    // Click Team tab
    const teamTab = page.locator('button', { hasText: 'quipe' }).or(
      page.locator('button', { hasText: 'Equipe' })
    );
    if (await teamTab.first().isVisible()) {
      await teamTab.first().click();
      await pause(page, 1200);
    }

    // Return to profile
    const profileTab = page.locator('button', { hasText: 'Profil' });
    if (await profileTab.first().isVisible()) {
      await profileTab.first().click();
      await pause(page, 800);
    }
  });

  // ━━━ 10/11 SDK DEMO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('10/11 - SDK Demo', async () => {
    await page.goto('/dashboard/sdk-demo');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '10/11 - SDK Demo');
    await pause(page, 1500);

    // Highlight the configuration panel
    await highlight(page, 'h2');
    await pause(page, 1000);

    // Highlight the SDK key input
    await highlight(page, '#sdk-key');
    await pause(page, 800);

    // Highlight the color picker
    await highlight(page, '#primary-color');
    await pause(page, 800);

    // Click the "Lancer le widget" button
    const launchButton = page.locator('button', { hasText: 'Lancer le widget' });
    if (await launchButton.isVisible()) {
      await highlight(page, 'button');
      await pause(page, 500);
      await launchButton.click();
      await pause(page, 2000);

      // Show the event log
      await highlight(page, '.divide-y');
      await pause(page, 1500);

      // Stop the widget
      const stopButton = page.locator('button', { hasText: 'Arreter le widget' });
      if (await stopButton.isVisible()) {
        await stopButton.click();
        await pause(page, 1000);
      }
    }
  });

  // ━━━ 11/11 DARK MODE + FIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await safeSection('11/11 - Dark Mode + Fin', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await showAnnotation(page, '11/11 - Dark Mode Toggle');
    await pause(page, 1000);

    // Click the theme toggle button (cycles light -> dark -> system)
    const themeButton = page.locator('button[aria-label*="theme" i], button[aria-label*="Thème" i], button[aria-label*="Changer le" i]');
    if (await themeButton.first().isVisible()) {
      // Toggle to dark mode
      await highlight(page, 'button[aria-label*="hème"]');
      await pause(page, 500);
      await themeButton.first().click();
      await pause(page, 2000);

      // Let the user see dark mode on the dashboard
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
      await pause(page, 1500);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await pause(page, 1000);

      // Toggle back to light
      await themeButton.first().click();
      await pause(page, 1000);
    }

    // Final annotation
    await showAnnotation(page, 'Demo Complete! - Support Helper Dashboard Tour');
    await pause(page, 3000);
  });
});
