import { describe, it, expect } from 'vitest';
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_STATUS_ORDER,
  OPEN_STATUSES,
  CLOSED_STATUSES,
} from './ticket-status';
import type { TicketStatus } from '../types/ticket';

describe('Ticket Status Constants', () => {
  const allStatuses: TicketStatus[] = [
    'new',
    'analyzing',
    'open',
    'in_progress',
    'waiting_response',
    'resolved',
    'closed',
  ];

  describe('TICKET_STATUS_LABELS', () => {
    it('should have labels for all statuses', () => {
      allStatuses.forEach(status => {
        expect(TICKET_STATUS_LABELS[status]).toBeDefined();
        expect(typeof TICKET_STATUS_LABELS[status]).toBe('string');
      });
    });

    it('should have human-readable labels', () => {
      expect(TICKET_STATUS_LABELS.new).toBe('New');
      expect(TICKET_STATUS_LABELS.in_progress).toBe('In Progress');
      expect(TICKET_STATUS_LABELS.waiting_response).toBe('Waiting Response');
    });
  });

  describe('TICKET_STATUS_COLORS', () => {
    it('should have colors for all statuses', () => {
      allStatuses.forEach(status => {
        expect(TICKET_STATUS_COLORS[status]).toBeDefined();
        expect(TICKET_STATUS_COLORS[status]).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should have distinct colors', () => {
      const colors = Object.values(TICKET_STATUS_COLORS);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('TICKET_STATUS_ORDER', () => {
    it('should contain all statuses', () => {
      expect(TICKET_STATUS_ORDER).toHaveLength(allStatuses.length);
      allStatuses.forEach(status => {
        expect(TICKET_STATUS_ORDER).toContain(status);
      });
    });

    it('should start with new and end with closed', () => {
      expect(TICKET_STATUS_ORDER[0]).toBe('new');
      expect(TICKET_STATUS_ORDER[TICKET_STATUS_ORDER.length - 1]).toBe('closed');
    });
  });

  describe('OPEN_STATUSES and CLOSED_STATUSES', () => {
    it('should cover all statuses between open and closed', () => {
      const combined = [...OPEN_STATUSES, ...CLOSED_STATUSES];
      expect(combined).toHaveLength(allStatuses.length);
      allStatuses.forEach(status => {
        expect(combined).toContain(status);
      });
    });

    it('should not have overlapping statuses', () => {
      const overlap = OPEN_STATUSES.filter(s => CLOSED_STATUSES.includes(s));
      expect(overlap).toHaveLength(0);
    });

    it('should have resolved and closed as closed statuses', () => {
      expect(CLOSED_STATUSES).toContain('resolved');
      expect(CLOSED_STATUSES).toContain('closed');
    });

    it('should have active workflow statuses as open', () => {
      expect(OPEN_STATUSES).toContain('new');
      expect(OPEN_STATUSES).toContain('in_progress');
      expect(OPEN_STATUSES).toContain('waiting_response');
    });
  });
});
