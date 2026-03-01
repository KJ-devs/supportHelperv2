/**
 * Tests for Toast component and ToastProvider
 */

import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from './Toast';

// Helper component to trigger toasts
function ToastTrigger({
  type,
  title,
  message,
  duration,
}: {
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
}) {
  const toast = useToast();
  return (
    <button
      onClick={() => toast.addToast({ type, title, message, duration })}
      data-testid="trigger"
    >
      Show Toast
    </button>
  );
}

function SuccessTrigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast.success('Success Title', 'Success message')} data-testid="success">
      Success
    </button>
  );
}

function ErrorTrigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast.error('Error Title', 'Error message')} data-testid="error">
      Error
    </button>
  );
}

function InfoTrigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast.info('Info Title')} data-testid="info">
      Info
    </button>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children without toasts initially', () => {
    render(
      <ToastProvider>
        <div data-testid="child">Content</div>
      </ToastProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a success toast when addToast is called', async () => {
    render(
      <ToastProvider>
        <ToastTrigger type="success" title="Test Success" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Test Success')).toBeInTheDocument();
  });

  it('renders a success toast via toast.success()', () => {
    render(
      <ToastProvider>
        <SuccessTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('success'));
    expect(screen.getByText('Success Title')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders an error toast via toast.error()', () => {
    render(
      <ToastProvider>
        <ErrorTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('error'));
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    // Error toast uses role="alert"
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders an info toast via toast.info()', () => {
    render(
      <ToastProvider>
        <InfoTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('info'));
    expect(screen.getByText('Info Title')).toBeInTheDocument();
  });

  it('renders toast message when provided', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="info" title="My Title" message="My message body" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My message body')).toBeInTheDocument();
  });

  it('auto-dismisses toast after default duration (5000ms for non-error)', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="success" title="Auto Dismiss" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Auto Dismiss')).toBeInTheDocument();

    // After 5000ms + 300ms close animation, toast should be removed
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByText('Auto Dismiss')).not.toBeInTheDocument();
  });

  it('auto-dismisses error toast after longer duration (8000ms)', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="error" title="Error Auto Dismiss" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Error Auto Dismiss')).toBeInTheDocument();

    // Should still be visible at 5000ms
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Error Auto Dismiss')).toBeInTheDocument();

    // Should be dismissed after 8000ms + 300ms
    act(() => {
      vi.advanceTimersByTime(3300);
    });

    expect(screen.queryByText('Error Auto Dismiss')).not.toBeInTheDocument();
  });

  it('auto-dismisses with custom duration', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="info" title="Custom Duration" duration={1000} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Custom Duration')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.queryByText('Custom Duration')).not.toBeInTheDocument();
  });

  it('dismisses toast manually via close button', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="success" title="Manual Close" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Manual Close')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /fermer la notification/i });
    fireEvent.click(closeButton);

    // After 300ms animation, toast is removed
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Manual Close')).not.toBeInTheDocument();
  });

  it('limits to 3 toasts maximum (MAX_TOASTS)', () => {
    function MultiTrigger() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast.success('Toast 1')} data-testid="t1" />
          <button onClick={() => toast.success('Toast 2')} data-testid="t2" />
          <button onClick={() => toast.success('Toast 3')} data-testid="t3" />
          <button onClick={() => toast.success('Toast 4')} data-testid="t4" />
        </>
      );
    }

    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('t1'));
    fireEvent.click(screen.getByTestId('t2'));
    fireEvent.click(screen.getByTestId('t3'));
    fireEvent.click(screen.getByTestId('t4'));

    // Only 3 should be visible (oldest dropped)
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
  });

  it('renders success type with border-green styling', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="success" title="Green Toast" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    const toastEl = screen.getByRole('status');
    expect(toastEl.className).toContain('border-green-500');
  });

  it('renders error type with border-red styling and assertive aria-live', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="error" title="Red Toast" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    const alertEl = screen.getByRole('alert');
    expect(alertEl.className).toContain('border-red-500');
    expect(alertEl).toHaveAttribute('aria-live', 'assertive');
  });

  it('renders info type with border-blue styling', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="info" title="Blue Toast" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    const statusEl = screen.getByRole('status');
    expect(statusEl.className).toContain('border-blue-500');
  });

  it('container has aria-live="polite" for accessibility', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="info" title="Accessible Toast" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger'));
    const container = screen.getByRole('status').closest('[aria-live="polite"]');
    expect(container).toBeInTheDocument();
  });
});
