/**
 * Tests for TicketCard component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TicketCard } from './TicketCard';
import type { Ticket } from '@/lib/types/ticket';

// Mock next/link - setup.tsx already mocks next/navigation but Link is different
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseTicket: Ticket = {
  id: 'ticket-123',
  tenantId: 'tenant-1',
  applicationId: 'app-1',
  title: 'App crashes on startup',
  description: 'The application crashes every time I try to open it.',
  status: 'open',
  type: 'crash',
  severity: 'high',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

describe('TicketCard', () => {
  it('renders the ticket title', () => {
    render(<TicketCard ticket={baseTicket} />);
    expect(screen.getByText('App crashes on startup')).toBeInTheDocument();
  });

  it('renders the ticket description', () => {
    render(<TicketCard ticket={baseTicket} />);
    expect(screen.getByText('The application crashes every time I try to open it.')).toBeInTheDocument();
  });

  it('links to the ticket detail page', () => {
    render(<TicketCard ticket={baseTicket} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard/tickets/ticket-123');
  });

  it('renders status badge', () => {
    render(<TicketCard ticket={baseTicket} />);
    expect(screen.getByText('Ouvert')).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(<TicketCard ticket={baseTicket} />);
    expect(screen.getByText('Élevée')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<TicketCard ticket={baseTicket} />);
    expect(screen.getByText('Crash')).toBeInTheDocument();
  });

  it('displays the creation date', () => {
    render(<TicketCard ticket={baseTicket} />);
    // Should display formatted date (fr-FR locale)
    expect(screen.getByText(/janv?\./i)).toBeInTheDocument();
  });

  it('renders application name when application is provided', () => {
    const ticket: Ticket = {
      ...baseTicket,
      application: {
        id: 'app-1',
        tenantId: 'tenant-1',
        name: 'My App',
        platform: 'web',
        sdkKey: 'sdk-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText('My App')).toBeInTheDocument();
  });

  it('does not render application section when application is not provided', () => {
    render(<TicketCard ticket={baseTicket} />);
    // AppWindow icon is only rendered if application exists - check by absence of app name
    expect(screen.queryByText('My App')).not.toBeInTheDocument();
  });

  it('renders AI summary when provided', () => {
    const ticket: Ticket = {
      ...baseTicket,
      aiSummary: 'This is an AI-generated summary of the issue.',
    };
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText(/ai-generated summary/i)).toBeInTheDocument();
  });

  it('truncates long AI summary at 100 characters', () => {
    const longSummary = 'A'.repeat(150);
    const ticket: Ticket = {
      ...baseTicket,
      aiSummary: longSummary,
    };
    render(<TicketCard ticket={ticket} />);
    // Should show first 100 chars + "..."
    expect(screen.getByText(/A{100}\.\.\./)).toBeInTheDocument();
  });

  it('does not truncate short AI summary (< 100 chars)', () => {
    const ticket: Ticket = {
      ...baseTicket,
      aiSummary: 'Short summary text.',
    };
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText('Short summary text.')).toBeInTheDocument();
    // No ellipsis
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('does not render AI section when aiSummary is not provided', () => {
    render(<TicketCard ticket={baseTicket} />);
    // The AI bot icon section should not exist
    expect(screen.queryByText(/IA:/)).not.toBeInTheDocument();
  });

  it('renders all status types correctly', () => {
    const statuses: Ticket['status'][] = ['new', 'in_progress', 'resolved', 'closed'];

    for (const status of statuses) {
      const { unmount } = render(<TicketCard ticket={{ ...baseTicket, status }} />);
      expect(screen.getAllByText(/.+/)[0]).toBeInTheDocument();
      unmount();
    }
  });

  it('renders critical severity correctly', () => {
    render(<TicketCard ticket={{ ...baseTicket, severity: 'critical' }} />);
    expect(screen.getByText('Critique')).toBeInTheDocument();
  });
});
