import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input Component', () => {
  it('renders with default props', () => {
    render(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    // Input component doesn't set explicit type, browser defaults to 'text'
    expect(input.tagName).toBe('INPUT');
  });

  it('renders with different types', () => {
    const { rerender } = render(<Input type="email" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');

    rerender(<Input type="number" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} data-testid="input" />);

    const input = screen.getByTestId('input');
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', () => {
    render(<Input disabled data-testid="input" />);

    expect(screen.getByTestId('input')).toBeDisabled();
  });

  it('can be readonly', () => {
    render(<Input readOnly value="readonly value" data-testid="input" />);

    expect(screen.getByTestId('input')).toHaveAttribute('readonly');
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" data-testid="input" />);

    expect(screen.getByTestId('input')).toHaveClass('custom-input');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });

  it('supports aria attributes', () => {
    render(<Input aria-label="Search" aria-describedby="search-help" data-testid="input" />);

    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('aria-label', 'Search');
    expect(input).toHaveAttribute('aria-describedby', 'search-help');
  });
});
