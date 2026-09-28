import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TicketFilters } from './TicketFilters';

describe('TicketFilters', () => {
  afterEach(() => vi.useRealTimers());

  it('applies the search automatically after the user stops typing', () => {
    vi.useFakeTimers();
    const onFiltersChange = vi.fn();
    render(<TicketFilters filters={{ page: 2 }} onFiltersChange={onFiltersChange} onReset={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Rechercher des tickets...'), {
      target: { value: 'login' },
    });
    expect(onFiltersChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ page: 1, search: 'login' });
  });

  it('only offers to reset when a filter is active', () => {
    const { rerender } = render(
      <TicketFilters filters={{}} onFiltersChange={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument();

    rerender(<TicketFilters filters={{ status: 'open' }} onFiltersChange={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeInTheDocument();
  });
});
