/**
 * Tests for Card, CardHeader, CardContent components
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardContent } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default padding', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('p-6');
  });

  it('does not apply padding when padding=false', () => {
    const { container } = render(<Card padding={false}>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('p-6');
  });

  it('has bg-white class by default', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-white');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-card">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-card');
  });

  it('has rounded-lg class', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
  });
});

describe('CardHeader', () => {
  it('renders the title', () => {
    render(<CardHeader title="My Card Title" />);
    expect(screen.getByText('My Card Title')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<CardHeader title="Title" subtitle="Subtitle text" />);
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(<CardHeader title="Title" />);
    expect(screen.queryByText('Subtitle text')).not.toBeInTheDocument();
  });

  it('renders action content when provided', () => {
    render(<CardHeader title="Title" action={<button>Action</button>} />);
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('does not render action section when not provided', () => {
    const { container } = render(<CardHeader title="Title" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // Should not have extra wrapper div for action
    expect(container.querySelectorAll('div').length).toBe(2); // outer + inner
  });

  it('title is an h3 element', () => {
    render(<CardHeader title="My Title" />);
    expect(screen.getByRole('heading', { level: 3, name: /my title/i })).toBeInTheDocument();
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content here</CardContent>);
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardContent className="custom-content">Content</CardContent>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-content');
  });

  it('renders without className when not provided', () => {
    const { container } = render(<CardContent>Content</CardContent>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toBe('');
  });
});
