/**
 * Tests for StatsCard component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsCard } from './StatsCard';
import { TrendingUp } from 'lucide-react';

describe('StatsCard', () => {
  it('renders the title', () => {
    render(<StatsCard title="Total Tickets" value={42} icon="🎫" />);
    expect(screen.getByText('Total Tickets')).toBeInTheDocument();
  });

  it('renders the numeric value', () => {
    render(<StatsCard title="Tickets" value={42} icon="🎫" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a string value', () => {
    render(<StatsCard title="Uptime" value="99.9%" icon="✅" />);
    expect(screen.getByText('99.9%')).toBeInTheDocument();
  });

  it('renders a string emoji icon', () => {
    render(<StatsCard title="Tickets" value={10} icon="🎫" />);
    expect(screen.getByText('🎫')).toBeInTheDocument();
  });

  it('renders a Lucide icon component', () => {
    render(<StatsCard title="Tickets" value={10} icon={TrendingUp} />);
    // LucideIcon renders as an SVG
    const svgEl = document.querySelector('svg');
    expect(svgEl).toBeInTheDocument();
    // Should have aria-hidden
    expect(svgEl).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders subtitle when provided', () => {
    render(<StatsCard title="Tickets" value={10} icon="🎫" subtitle="Last 30 days" />);
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(<StatsCard title="Tickets" value={10} icon="🎫" />);
    expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument();
  });

  it('renders positive trend value', () => {
    render(
      <StatsCard
        title="Tickets"
        value={10}
        icon="🎫"
        trend={{ value: 15, isPositive: true }}
      />
    );
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('renders negative trend value with absolute display', () => {
    render(
      <StatsCard
        title="Tickets"
        value={10}
        icon="🎫"
        trend={{ value: -8, isPositive: false }}
      />
    );
    // Math.abs(-8) = 8
    expect(screen.getByText('8%')).toBeInTheDocument();
  });

  it('shows green color for positive trend', () => {
    const { container } = render(
      <StatsCard
        title="Tickets"
        value={10}
        icon="🎫"
        trend={{ value: 5, isPositive: true }}
      />
    );
    const trendEl = container.querySelector('.text-green-600');
    expect(trendEl).toBeInTheDocument();
  });

  it('shows red color for negative trend', () => {
    const { container } = render(
      <StatsCard
        title="Tickets"
        value={10}
        icon="🎫"
        trend={{ value: 5, isPositive: false }}
      />
    );
    const trendEl = container.querySelector('.text-red-600');
    expect(trendEl).toBeInTheDocument();
  });

  it('does not render trend section when no trend provided', () => {
    const { container } = render(<StatsCard title="Tickets" value={10} icon="🎫" />);
    expect(container.querySelector('.text-green-600')).not.toBeInTheDocument();
    expect(container.querySelector('.text-red-600')).not.toBeInTheDocument();
  });

  it('renders with default variant (bg-gray-50)', () => {
    const { container } = render(<StatsCard title="Tickets" value={10} icon="🎫" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-gray-50');
  });

  it('renders with primary variant', () => {
    const { container } = render(
      <StatsCard title="Tickets" value={10} icon="🎫" variant="primary" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-blue-50');
  });

  it('renders with success variant', () => {
    const { container } = render(
      <StatsCard title="Tickets" value={10} icon="🎫" variant="success" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-green-50');
  });

  it('renders with warning variant', () => {
    const { container } = render(
      <StatsCard title="Tickets" value={10} icon="🎫" variant="warning" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-yellow-50');
  });

  it('renders with danger variant', () => {
    const { container } = render(
      <StatsCard title="Tickets" value={10} icon="🎫" variant="danger" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-red-50');
  });
});
