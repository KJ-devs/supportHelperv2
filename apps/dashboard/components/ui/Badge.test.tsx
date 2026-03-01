/**
 * Tests for Badge, StatusBadge, SeverityBadge, TypeBadge components
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge, StatusBadge, SeverityBadge, TypeBadge } from './Badge';
import type { TicketStatus, TicketSeverity, TicketType } from '@/lib/types/ticket';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('uses default variant styling', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-gray-100');
  });

  it('renders success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success').className).toContain('bg-green-100');
  });

  it('renders warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning').className).toContain('bg-yellow-100');
  });

  it('renders danger variant', () => {
    render(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText('Danger').className).toContain('bg-red-100');
  });

  it('renders info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText('Info').className).toContain('bg-blue-100');
  });

  it('applies custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('custom-badge');
  });

  it('is a span element', () => {
    render(<Badge>Span Badge</Badge>);
    const el = screen.getByText('Span Badge');
    expect(el.tagName.toLowerCase()).toBe('span');
  });
});

describe('StatusBadge', () => {
  const statuses: TicketStatus[] = [
    'new',
    'open',
    'in_progress',
    'resolved',
    'closed',
    'analyzing',
    'analyzed',
    'analysis_failed',
  ];

  it.each(statuses)('renders without crashing for status "%s"', (status) => {
    const { container } = render(<StatusBadge status={status} />);
    // Each status has a label — just verify something is rendered
    expect(container.firstChild).toBeInTheDocument();
  });

  it('shows "Nouveau" for status new', () => {
    render(<StatusBadge status="new" />);
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
  });

  it('shows "Ouvert" for status open', () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText('Ouvert')).toBeInTheDocument();
  });

  it('shows "En cours" for status in_progress', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('shows "Résolu" for status resolved', () => {
    render(<StatusBadge status="resolved" />);
    expect(screen.getByText('Résolu')).toBeInTheDocument();
  });

  it('shows "Fermé" for status closed', () => {
    render(<StatusBadge status="closed" />);
    expect(screen.getByText('Fermé')).toBeInTheDocument();
  });

  it('shows "Analyse..." for status analyzing', () => {
    render(<StatusBadge status="analyzing" />);
    expect(screen.getByText('Analyse...')).toBeInTheDocument();
  });

  it('shows "Analysé" for status analyzed', () => {
    render(<StatusBadge status="analyzed" />);
    expect(screen.getByText('Analysé')).toBeInTheDocument();
  });

  it('shows "Échec analyse" for status analysis_failed', () => {
    render(<StatusBadge status="analysis_failed" />);
    expect(screen.getByText('Échec analyse')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  const severities: TicketSeverity[] = ['critical', 'high', 'medium', 'low'];

  it.each(severities)('renders without crashing for severity "%s"', (severity) => {
    const { container } = render(<SeverityBadge severity={severity} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('shows "Critique" for critical severity', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText(/critique/i)).toBeInTheDocument();
  });

  it('shows "Élevée" for high severity', () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText(/élevée/i)).toBeInTheDocument();
  });

  it('shows "Moyenne" for medium severity', () => {
    render(<SeverityBadge severity="medium" />);
    expect(screen.getByText(/moyenne/i)).toBeInTheDocument();
  });

  it('shows "Faible" for low severity', () => {
    render(<SeverityBadge severity="low" />);
    expect(screen.getByText(/faible/i)).toBeInTheDocument();
  });

  it('shows icon by default', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('🔴')).toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    render(<SeverityBadge severity="critical" showIcon={false} />);
    expect(screen.queryByText('🔴')).not.toBeInTheDocument();
    expect(screen.getByText(/critique/i)).toBeInTheDocument();
  });
});

describe('TypeBadge', () => {
  const types: TicketType[] = ['bug', 'crash', 'performance', 'ui', 'feature_request', 'other'];

  it.each(types)('renders without crashing for type "%s"', (type) => {
    const { container } = render(<TypeBadge type={type} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('shows "Bug" for bug type', () => {
    render(<TypeBadge type="bug" />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('shows "Crash" for crash type', () => {
    render(<TypeBadge type="crash" />);
    expect(screen.getByText('Crash')).toBeInTheDocument();
  });

  it('shows "Performance" for performance type', () => {
    render(<TypeBadge type="performance" />);
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });

  it('shows "Interface" for ui type', () => {
    render(<TypeBadge type="ui" />);
    expect(screen.getByText('Interface')).toBeInTheDocument();
  });

  it('shows "Fonctionnalité" for feature_request type', () => {
    render(<TypeBadge type="feature_request" />);
    expect(screen.getByText('Fonctionnalité')).toBeInTheDocument();
  });

  it('shows "Autre" for other type', () => {
    render(<TypeBadge type="other" />);
    expect(screen.getByText('Autre')).toBeInTheDocument();
  });

  it('includes emoji icon', () => {
    render(<TypeBadge type="bug" />);
    expect(screen.getByText('🐛')).toBeInTheDocument();
  });
});
