/**
 * Tests for ConnectionStatus component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  describe('connected state', () => {
    it('renders "Live" label when connected', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('shows green dot when connected', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      const container = screen.getByRole('status');
      expect(container.innerHTML).toContain('bg-green-500');
    });

    it('has correct tooltip text when connected', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      const status = screen.getByRole('status');
      expect(status.getAttribute('title')).toBe('Connecté — mises à jour en temps réel actives');
    });

    it('has correct aria-label when connected', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-label')).toBe('Connecté — mises à jour en temps réel actives');
    });

    it('shows pulse animation ring when connected', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      const status = screen.getByRole('status');
      expect(status.innerHTML).toContain('animate-ping');
    });

    it('shows tooltip element with connected message', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Connecté — mises à jour en temps réel actives');
    });
  });

  describe('reconnecting state', () => {
    it('renders "Reconnexion" label when not connected with transient error', () => {
      render(<ConnectionStatus isConnected={false} error="Unable to connect to real-time ticket updates" />);
      expect(screen.getByText('Reconnexion')).toBeInTheDocument();
    });

    it('renders "Reconnexion" label when not connected with null error', () => {
      render(<ConnectionStatus isConnected={false} error={null} />);
      expect(screen.getByText('Reconnexion')).toBeInTheDocument();
    });

    it('shows orange dot when reconnecting', () => {
      render(<ConnectionStatus isConnected={false} error={null} />);
      const container = screen.getByRole('status');
      expect(container.innerHTML).toContain('bg-orange-500');
    });

    it('has correct tooltip text when reconnecting', () => {
      render(<ConnectionStatus isConnected={false} error={null} />);
      const status = screen.getByRole('status');
      expect(status.getAttribute('title')).toBe('Reconnexion en cours…');
    });

    it('shows pulse animation ring when reconnecting', () => {
      render(<ConnectionStatus isConnected={false} error={null} />);
      const status = screen.getByRole('status');
      expect(status.innerHTML).toContain('animate-ping');
    });
  });

  describe('disconnected state', () => {
    it('renders "Hors ligne" label when reconnect failed', () => {
      render(
        <ConnectionStatus
          isConnected={false}
          error="Real-time connection lost. Please refresh the page."
        />
      );
      expect(screen.getByText('Hors ligne')).toBeInTheDocument();
    });

    it('renders "Hors ligne" label when not authenticated', () => {
      render(<ConnectionStatus isConnected={false} error="Not authenticated" />);
      expect(screen.getByText('Hors ligne')).toBeInTheDocument();
    });

    it('shows red dot when disconnected', () => {
      render(
        <ConnectionStatus
          isConnected={false}
          error="Real-time connection lost. Please refresh the page."
        />
      );
      const container = screen.getByRole('status');
      expect(container.innerHTML).toContain('bg-red-500');
    });

    it('has correct tooltip text when disconnected', () => {
      render(
        <ConnectionStatus
          isConnected={false}
          error="Real-time connection lost. Please refresh the page."
        />
      );
      const status = screen.getByRole('status');
      expect(status.getAttribute('title')).toBe(
        'Déconnecté — les mises à jour en temps réel sont inactives'
      );
    });

    it('does NOT show pulse animation when disconnected', () => {
      render(
        <ConnectionStatus
          isConnected={false}
          error="Real-time connection lost. Please refresh the page."
        />
      );
      const status = screen.getByRole('status');
      expect(status.innerHTML).not.toContain('animate-ping');
    });

    it('shows tooltip with disconnected message', () => {
      render(
        <ConnectionStatus
          isConnected={false}
          error="Real-time connection lost. Please refresh the page."
        />
      );
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Déconnecté — les mises à jour en temps réel sont inactives');
    });
  });

  describe('state priority', () => {
    it('connected takes priority over error (should not happen in practice)', () => {
      render(
        <ConnectionStatus
          isConnected={true}
          error="Real-time connection lost. Please refresh the page."
        />
      );
      // isConnected=true always returns 'connected'
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="status" attribute', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has role="tooltip" for the tooltip div', () => {
      render(<ConnectionStatus isConnected={true} error={null} />);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });
});
