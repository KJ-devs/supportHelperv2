/**
 * Tests for Input component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with a label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('label is associated with input via htmlFor/id', () => {
    render(<Input label="Username" />);
    const input = screen.getByRole('textbox');
    const label = screen.getByText('Username');
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it('renders required indicator when required prop is set', () => {
    render(<Input label="Email" required />);
    expect(screen.getByLabelText('requis')).toBeInTheDocument();
  });

  it('renders error message when error prop is provided', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
  });

  it('sets aria-invalid="true" when error is present', () => {
    render(<Input error="Invalid value" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-invalid="false" when no error', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('renders helper text when helperText prop is provided', () => {
    render(<Input helperText="Enter your email address" />);
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
  });

  it('does not render helper text when error is also provided', () => {
    render(<Input error="Error!" helperText="Helper text" />);
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('associates aria-describedby with error id when error is present', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    const errorId = input.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    const errorEl = document.getElementById(errorId!);
    expect(errorEl?.textContent).toBe('Error message');
  });

  it('associates aria-describedby with helper id when helperText is present', () => {
    render(<Input helperText="Helper message" />);
    const input = screen.getByRole('textbox');
    const helperId = input.getAttribute('aria-describedby');
    expect(helperId).toBeTruthy();
    const helperEl = document.getElementById(helperId!);
    expect(helperEl?.textContent).toBe('Helper message');
  });

  it('accepts a custom id and uses it for the input', () => {
    render(<Input id="custom-input" label="Custom" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'custom-input');
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders with placeholder text', () => {
    render(<Input placeholder="Type here..." />);
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders password input type', () => {
    render(<Input type="password" />);
    const input = document.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
  });

  it('applies custom className to the input', () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole('textbox').className).toContain('custom-input');
  });

  it('exposes displayName', () => {
    expect(Input.displayName).toBe('Input');
  });

  it('applies border-red-500 class when error is present', () => {
    render(<Input error="Error" />);
    expect(screen.getByRole('textbox').className).toContain('border-red-500');
  });

  it('applies default border class when no error', () => {
    render(<Input />);
    expect(screen.getByRole('textbox').className).toContain('border-gray-300');
  });
});
