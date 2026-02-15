import { Injectable } from '@nestjs/common';

/**
 * Available template placeholders and their descriptions.
 */
export const TEMPLATE_PLACEHOLDERS: Record<string, string> = {
  '{{title}}': 'Ticket title',
  '{{description}}': 'Ticket description',
  '{{severity}}': 'Severity level (low, medium, high, critical)',
  '{{type}}': 'Ticket type (bug, feature, question, etc.)',
  '{{steps}}': 'Reproduction steps',
  '{{recording_url}}': 'Link to the video recording',
  '{{ticket_url}}': 'Link to the ticket in Support Helper',
  '{{reporter}}': 'Reporter information (email or name)',
  '{{ai_analysis}}': 'AI-generated analysis summary',
  '{{user_context}}': 'User context (OS, browser, URL)',
  '{{ticket_id}}': 'Ticket ID (short)',
  '{{status}}': 'Current ticket status',
};

/**
 * Default issue template used when no custom template is configured.
 */
export const DEFAULT_TEMPLATE = `## Description

{{description}}

## AI Analysis

{{ai_analysis}}

## Reproduction Steps

{{steps}}

## User Context

{{user_context}}

## Media

{{recording_url}}

---

**Ticket ID**: \`{{ticket_id}}\` | **Type**: {{type}} | **Severity**: {{severity}} | **Status**: {{status}}

*Created from [Support Helper]({{ticket_url}})*
`;

@Injectable()
export class TemplateRendererService {
  /**
   * Render a template by replacing placeholders with actual data values.
   * Unknown placeholders are left as-is.
   */
  render(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = key.startsWith('{{') ? key : `{{${key}}}`;
      result = result.split(placeholder).join(value || '');
    }
    return result;
  }

  /**
   * Validate a template string. Returns info about which known
   * placeholders are present and which are missing.
   */
  validate(template: string): {
    valid: boolean;
    placeholders: string[];
    missingPlaceholders: string[];
  } {
    const knownKeys = Object.keys(TEMPLATE_PLACEHOLDERS);
    const present = knownKeys.filter((p) => template.includes(p));
    const missing = knownKeys.filter((p) => !template.includes(p));

    return {
      valid: template.trim().length > 0,
      placeholders: present,
      missingPlaceholders: missing,
    };
  }

  /**
   * Return the default template.
   */
  getDefaultTemplate(): string {
    return DEFAULT_TEMPLATE;
  }

  /**
   * Return placeholder metadata for the UI.
   */
  getPlaceholders(): Record<string, string> {
    return { ...TEMPLATE_PLACEHOLDERS };
  }

  /**
   * Generate sample data for template preview.
   */
  getSampleData(): Record<string, string> {
    return {
      title: 'Login button not responding on mobile',
      description:
        'When tapping the login button on mobile Safari, nothing happens. The button does not show any loading state and the form is not submitted.',
      severity: 'high',
      type: 'bug',
      steps:
        '1. Open the app on mobile Safari\n2. Enter valid credentials\n3. Tap the "Login" button\n4. Observe nothing happens',
      recording_url: '[View Recording](https://app.example.com/media/abc123)',
      ticket_url: 'https://app.example.com/tickets/abc12345',
      reporter: 'jane.doe@example.com',
      ai_analysis:
        'The login form submit handler appears to be missing a touch event listener. The click event fires on desktop but not on certain mobile browsers due to the 300ms tap delay. Consider adding a touchend handler or using a CSS touch-action property.',
      user_context:
        '- **OS**: iOS 17.2\n- **Browser**: Safari 17\n- **URL**: https://app.example.com/login',
      ticket_id: 'abc12345',
      status: 'open',
    };
  }
}
