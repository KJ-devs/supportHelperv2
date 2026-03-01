/**
 * Tests for UsageBar component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UsageBar } from './UsageBar';

describe('UsageBar', () => {
  it('renders the label', () => {
    render(<UsageBar label="Tickets" current={50} limit={100} percentage={50} />);
    expect(screen.getByText('Tickets')).toBeInTheDocument();
  });

  it('renders current and limit values', () => {
    render(<UsageBar label="API Calls" current={500} limit={1000} percentage={50} />);
    // "500 / 1,000" – formatted with toLocaleString
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it('renders "Unlimited" when limit is null', () => {
    render(<UsageBar label="Storage" current={100} limit={null} percentage={10} />);
    expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
  });

  it('shows green bar when percentage < 60', () => {
    const { container } = render(
      <UsageBar label="Usage" current={30} limit={100} percentage={30} />
    );
    const bar = container.querySelector('.bg-green-500');
    expect(bar).toBeInTheDocument();
  });

  it('shows orange bar when percentage is between 60 and 79', () => {
    const { container } = render(
      <UsageBar label="Usage" current={70} limit={100} percentage={70} />
    );
    const bar = container.querySelector('.bg-orange-500');
    expect(bar).toBeInTheDocument();
  });

  it('shows red bar when percentage is 80 or above', () => {
    const { container } = render(
      <UsageBar label="Usage" current={85} limit={100} percentage={85} />
    );
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
  });

  it('caps bar width at 100% when percentage exceeds 100', () => {
    const { container } = render(
      <UsageBar label="Usage" current={150} limit={100} percentage={150} />
    );
    const bar = container.querySelector('[style]') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('sets bar width exactly to percentage value', () => {
    const { container } = render(
      <UsageBar label="Usage" current={45} limit={100} percentage={45} />
    );
    const bar = container.querySelector('[style]') as HTMLElement;
    expect(bar.style.width).toBe('45%');
  });

  it('shows red bar at exactly 80%', () => {
    const { container } = render(
      <UsageBar label="Usage" current={80} limit={100} percentage={80} />
    );
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
  });

  it('shows orange bar at exactly 60%', () => {
    const { container } = render(
      <UsageBar label="Usage" current={60} limit={100} percentage={60} />
    );
    const bar = container.querySelector('.bg-orange-500');
    expect(bar).toBeInTheDocument();
  });

  it('renders with 0 current and 0 percentage', () => {
    render(<UsageBar label="Empty" current={0} limit={100} percentage={0} />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});
