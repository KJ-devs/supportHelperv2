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
        title="No items found"
        description="There are no items to display at this time."
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display at this time.')).toBeInTheDocument();
  });

  it('renders without description', () => {
    render(<EmptyState icon={Inbox} title="No items found" />);

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.queryByText('There are no items to display')).not.toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const handleClick = vi.fn();

    render(
      <EmptyState
        icon={Inbox}
        title="No items found"
        action={{
          label: 'Create item',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Create item' });
    expect(button).toBeInTheDocument();
  });

  it('calls action onClick when button is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <EmptyState
        icon={Inbox}
        title="No items found"
        action={{
          label: 'Create item',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Create item' });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when not provided', () => {
    render(<EmptyState icon={Inbox} title="No items found" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="No items found" className="custom-class" />
    );

    const emptyStateDiv = container.firstChild;
    expect(emptyStateDiv).toHaveClass('custom-class');
  });
});
