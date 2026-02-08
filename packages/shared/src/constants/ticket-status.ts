import type { TicketStatus } from '../types/ticket';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  analyzing: 'Analyzing',
  open: 'Open',
  in_progress: 'In Progress',
  waiting_response: 'Waiting Response',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  new: '#3B82F6', // blue
  analyzing: '#8B5CF6', // purple
  open: '#F59E0B', // amber
  in_progress: '#10B981', // emerald
  waiting_response: '#6B7280', // gray
  resolved: '#22C55E', // green
  closed: '#64748B', // slate
};

export const TICKET_STATUS_ORDER: TicketStatus[] = [
  'new',
  'analyzing',
  'open',
  'in_progress',
  'waiting_response',
  'resolved',
  'closed',
];

export const OPEN_STATUSES: TicketStatus[] = [
  'new',
  'analyzing',
  'open',
  'in_progress',
  'waiting_response',
];

export const CLOSED_STATUSES: TicketStatus[] = [
  'resolved',
  'closed',
];
