/**
 * Tests for ConfirmModal component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Confirm Action',
  message: 'Are you sure you want to do this?',
};

describe('ConfirmModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the modal when isOpen is true', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays the title', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
  });

  it('displays the message', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Are you sure you want to do this?')).toBeInTheDocument();
  });

  it('renders default confirm label "Confirmer"', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /confirmer/i })).toBeInTheDocument();
  });

  it('renders default cancel label "Annuler"', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
  });

  it('renders custom confirm label', () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Delete" />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('renders custom cancel label', () => {
    render(<ConfirmModal {...defaultProps} cancelLabel="Go back" />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the modal close (X) button', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    // The overlay is the fixed bg-black div behind the modal
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "En cours..." text on confirm button when isLoading', () => {
    render(<ConfirmModal {...defaultProps} isLoading />);
    expect(screen.getByText('En cours...')).toBeInTheDocument();
  });

  it('disables cancel button when isLoading', () => {
    render(<ConfirmModal {...defaultProps} isLoading />);
    const cancelBtn = screen.getByRole('button', { name: /annuler/i });
    expect(cancelBtn).toBeDisabled();
  });

  it('disables confirm button when isLoading', () => {
    render(<ConfirmModal {...defaultProps} isLoading />);
    const confirmBtn = screen.getByText('En cours...').closest('button') as HTMLButtonElement;
    expect(confirmBtn).toBeDisabled();
  });

  it('does not call onConfirm when disabled (isLoading)', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} isLoading />);
    const confirmBtn = screen.getByText('En cours...').closest('button') as HTMLButtonElement;
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses primary variant by default', () => {
    render(<ConfirmModal {...defaultProps} />);
    // The confirm button should have primary styling (blue)
    const confirmBtn = screen.getByRole('button', { name: /confirmer/i });
    expect(confirmBtn.className).toContain('bg-blue-600');
  });

  it('uses danger variant when variant="danger"', () => {
    render(<ConfirmModal {...defaultProps} variant="danger" />);
    const confirmBtn = screen.getByRole('button', { name: /confirmer/i });
    expect(confirmBtn.className).toContain('bg-red-600');
  });

  it('renders multiline message correctly', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        message={`Line 1\nLine 2`}
      />
    );
    const msgEl = screen.getByText((content) => content.includes('Line 1'));
    expect(msgEl).toBeInTheDocument();
  });
});
