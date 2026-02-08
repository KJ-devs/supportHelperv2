import type { TicketSeverity } from '../types/ticket';

export const SEVERITY_LABELS: Record<TicketSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const SEVERITY_COLORS: Record<TicketSeverity, string> = {
  critical: '#DC2626', // red
  high: '#F97316', // orange
  medium: '#EAB308', // yellow
  low: '#22C55E', // green
};

export const SEVERITY_PRIORITY: Record<TicketSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const SEVERITY_DESCRIPTIONS: Record<TicketSeverity, string> = {
  critical: 'System down, data loss, or security breach. Requires immediate attention.',
  high: 'Major feature broken, significant impact on users. Fix within hours.',
  medium: 'Feature partially working, workaround available. Fix within days.',
  low: 'Minor issue, cosmetic problem, or enhancement request. Fix when possible.',
};
