/**
 * Tests for Pagination component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('returns null when totalPages is 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when totalPages is 0', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders navigation when totalPages > 1', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('displays current page and total pages', () => {
    render(<Pagination currentPage={3} totalPages={10} onPageChange={vi.fn()} />);
    // "Page 3 sur 10" — use getAllByText since page number also appears in button list
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    // Total pages "10" appears in the text and as a button label
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
  });

  it('renders previous button', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /page précédente/i })).toBeInTheDocument();
  });

  it('renders next button', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /page suivante/i })).toBeInTheDocument();
  });

  it('previous button is disabled on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /page précédente/i })).toBeDisabled();
  });

  it('next button is disabled on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /page suivante/i })).toBeDisabled();
  });

  it('previous button is enabled when not on first page', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /page précédente/i })).not.toBeDisabled();
  });

  it('next button is enabled when not on last page', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /page suivante/i })).not.toBeDisabled();
  });

  it('calls onPageChange with currentPage - 1 when previous is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /page précédente/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with currentPage + 1 when next is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /page suivante/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('renders all page numbers when totalPages <= 7', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Page ${i}` })).toBeInTheDocument();
    }
  });

  it('marks current page with aria-current="page"', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const currentBtn = screen.getByRole('button', { name: 'Page 2' });
    expect(currentBtn).toHaveAttribute('aria-current', 'page');
  });

  it('other pages do not have aria-current attribute', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const page1Btn = screen.getByRole('button', { name: 'Page 1' });
    expect(page1Btn).not.toHaveAttribute('aria-current');
  });

  it('calls onPageChange with correct page number when page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Page 4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('shows ellipsis for large page counts (currentPage near start)', () => {
    render(<Pagination currentPage={2} totalPages={10} onPageChange={vi.fn()} />);
    // Should see pages 1-5, ellipsis, 10
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument();
  });

  it('shows ellipsis for large page counts (currentPage near end)', () => {
    render(<Pagination currentPage={9} totalPages={10} onPageChange={vi.fn()} />);
    // Should see 1, ellipsis, pages 6-10
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
  });

  it('shows two ellipsis for currentPage in middle of large page set', () => {
    render(<Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />);
    const ellipses = screen.getAllByText('...');
    expect(ellipses).toHaveLength(2);
  });

  it('has role="navigation" with aria-label', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
  });

  it('current page button has highlighted styling', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const currentBtn = screen.getByRole('button', { name: 'Page 2' });
    expect(currentBtn.className).toContain('bg-blue-600');
  });

  it('non-current page buttons do not have highlighted styling', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const otherBtn = screen.getByRole('button', { name: 'Page 1' });
    expect(otherBtn.className).not.toContain('bg-blue-600');
  });
});
