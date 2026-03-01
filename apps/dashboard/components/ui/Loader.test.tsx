/**
 * Tests for Loader and PageLoader components
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Loader, PageLoader } from './Loader';

describe('Loader', () => {
  it('renders with role="status"', () => {
    render(<Loader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-busy="true"', () => {
    render(<Loader />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders sr-only default loading text when no text prop', () => {
    render(<Loader />);
    expect(screen.getByText('Chargement en cours')).toBeInTheDocument();
  });

  it('renders visible text when text prop is provided', () => {
    render(<Loader text="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('does not render sr-only text when text prop is provided', () => {
    render(<Loader text="Loading data" />);
    // sr-only default text should not be present
    expect(screen.queryByText('Chargement en cours')).not.toBeInTheDocument();
  });

  it('renders sm size spinner', () => {
    const { container } = render(<Loader size="sm" />);
    // Use innerHTML to check SVG class since SVG className is an SVGAnimatedString in jsdom
    expect(container.innerHTML).toContain('h-4');
    expect(container.innerHTML).toContain('w-4');
  });

  it('renders md size spinner by default', () => {
    const { container } = render(<Loader />);
    expect(container.innerHTML).toContain('h-8');
    expect(container.innerHTML).toContain('w-8');
  });

  it('renders lg size spinner', () => {
    const { container } = render(<Loader size="lg" />);
    expect(container.innerHTML).toContain('h-12');
    expect(container.innerHTML).toContain('w-12');
  });

  it('renders fullscreen overlay when fullScreen is true', () => {
    const { container } = render(<Loader fullScreen />);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
  });

  it('does not render fullscreen overlay by default', () => {
    render(<Loader />);
    const status = screen.getByRole('status');
    // First child should be the status div, not a fixed overlay
    expect(status.className).not.toContain('fixed');
  });

  it('spinner has animate-spin class', () => {
    const { container } = render(<Loader />);
    expect(container.innerHTML).toContain('animate-spin');
  });

  it('spinner is an SVG element', () => {
    const { container } = render(<Loader />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('PageLoader', () => {
  it('renders without errors', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows "Chargement..." text', () => {
    render(<PageLoader />);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('renders with lg size spinner', () => {
    const { container } = render(<PageLoader />);
    expect(container.innerHTML).toContain('h-12');
  });

  it('is centered in a full-height container', () => {
    const { container } = render(<PageLoader />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('min-h-screen');
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
  });
});
