import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './empty-state';
import { Inbox } from 'lucide-react';

describe('EmptyState', () => {
  it('renders with icon, title, and description', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No tickets yet"
        description="Get started by creating your first ticket."
      />
    );

    expect(screen.getByText('No tickets yet')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first ticket.')).toBeInTheDocument();
  });

  it('renders action button when actionLabel is provided', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        title="No tickets yet"
        description="Get started by creating your first ticket."
        actionLabel="Create ticket"
        onAction={onAction}
      />
    );

    const button = screen.getByRole('button', { name: 'Create ticket' });
    expect(button).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        icon={Inbox}
        title="No tickets yet"
        actionLabel="Create ticket"
        onAction={onAction}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders compact variant with smaller icon', () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        title="No tickets yet"
        variant="compact"
      />
    );

    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('h-8', 'w-8');
  });

  it('renders default variant with larger icon', () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        title="No tickets yet"
        variant="default"
      />
    );

    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('h-12', 'w-12');
  });
});
