/**
 * Tests for Select component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3' },
];

describe('Select', () => {
  it('renders a select element', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('renders a label when provided', () => {
    render(<Select options={options} label="Category" />);
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('shows required asterisk when required prop is set', () => {
    render(<Select options={options} label="Category" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders placeholder option when provided', () => {
    render(<Select options={options} placeholder="Select an option" />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('placeholder option is disabled', () => {
    render(<Select options={options} placeholder="Select one" />);
    const placeholder = screen.getByRole('option', { name: 'Select one' });
    expect(placeholder).toBeDisabled();
  });

  it('renders error message when error prop is provided', () => {
    render(<Select options={options} error="Please select an option" />);
    expect(screen.getByText('Please select an option')).toBeInTheDocument();
  });

  it('applies border-red-500 class when error is present', () => {
    render(<Select options={options} error="Error" />);
    expect(screen.getByRole('combobox').className).toContain('border-red-500');
  });

  it('applies default border class when no error', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox').className).toContain('border-gray-300');
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('calls onChange when user selects an option', () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'opt2' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('shows selected value via value prop', () => {
    const onChange = vi.fn();
    render(<Select options={options} value="opt2" onChange={onChange} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('opt2');
  });

  it('applies custom className', () => {
    render(<Select options={options} className="custom-select" />);
    expect(screen.getByRole('combobox').className).toContain('custom-select');
  });

  it('exposes displayName', () => {
    expect(Select.displayName).toBe('Select');
  });
});
