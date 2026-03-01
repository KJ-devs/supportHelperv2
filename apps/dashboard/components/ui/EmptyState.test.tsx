/**
 * Tests for EmptyState component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No tickets found" />);
    expect(screen.getByText('No tickets found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="There is nothing here yet." />);
    expect(screen.getByText('There is nothing here yet.')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('There is nothing here yet.')).not.toBeInTheDocument();
  });

  it('renders action button with label when onAction is provided', () => {
    render(<EmptyState title="Empty" actionLabel="Create New" onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create new/i })).toBeInTheDocument();
  });

  it('renders action link when actionHref is provided', () => {
    render(<EmptyState title="Empty" actionLabel="Go somewhere" actionHref="/somewhere" />);
    expect(screen.getByRole('link', { name: /go somewhere/i })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/somewhere');
  });

  it('does not render action button when neither onAction nor actionHref is provided', () => {
    render(<EmptyState title="Empty" actionLabel="Do something" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction when button is clicked', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Empty" actionLabel="Create" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders string icon', () => {
    render(<EmptyState title="Empty" icon="🎉" />);
    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('renders React node icon in a wrapper div', () => {
    const icon = <svg data-testid="svg-icon" />;
    render(<EmptyState title="Empty" icon={icon} />);
    expect(screen.getByTestId('svg-icon')).toBeInTheDocument();
  });

  it('does not render icon section when icon is not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    // No icon containers should exist
    expect(container.querySelector('.text-4xl')).not.toBeInTheDocument();
    expect(container.querySelector('.text-6xl')).not.toBeInTheDocument();
    expect(container.querySelector('.text-8xl')).not.toBeInTheDocument();
  });

  it('applies sm size classes', () => {
    const { container } = render(<EmptyState title="Empty" size="sm" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('py-8');
  });

  it('applies md size classes by default', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('py-12');
  });

  it('applies lg size classes', () => {
    const { container } = render(<EmptyState title="Empty" size="lg" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('py-16');
  });

  it('applies bordered variant classes', () => {
    const { container } = render(<EmptyState title="Empty" variant="bordered" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-dashed');
  });

  it('does not apply bordered classes for default variant', () => {
    const { container } = render(<EmptyState title="Empty" variant="default" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain('border-dashed');
  });

  it('title is rendered as h3', () => {
    render(<EmptyState title="My Title" />);
    const heading = screen.getByRole('heading', { level: 3, name: /my title/i });
    expect(heading).toBeInTheDocument();
  });
});
