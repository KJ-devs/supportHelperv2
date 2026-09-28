import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamSettings } from './TeamSettings';
import { usersApi } from '@/lib/api/users';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/api/users', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/users')>('@/lib/api/users');
  return {
    ...actual,
    usersApi: {
      getUsers: vi.fn(),
      invite: vi.fn(),
      resendInvitation: vi.fn(),
      updateRole: vi.fn(),
      remove: vi.fn(),
    },
  };
});

const members = [
  { id: 'owner-1', tenantId: 't', email: 'alice@acme.test', name: 'Alice', role: 'owner', createdAt: '' },
  { id: 'admin-1', tenantId: 't', email: 'bob@acme.test', name: 'Bob', role: 'admin', createdAt: '' },
  {
    id: 'member-1',
    tenantId: 't',
    email: 'carol@acme.test',
    name: 'Carol',
    role: 'member',
    createdAt: '',
    invitationPending: true,
  },
];

describe('TeamSettings', () => {
  beforeEach(() => {
    vi.mocked(usersApi.getUsers).mockResolvedValue(members);
  });

  it('lists every member and flags pending invitations', async () => {
    render(<TeamSettings currentUser={{ id: 'owner-1', role: 'owner' }} />);

    expect(await screen.findByText('carol@acme.test')).toBeInTheDocument();
    expect(screen.getByText('bob@acme.test')).toBeInTheDocument();
    expect(screen.getByText('Invitation en attente')).toBeInTheDocument();
    expect(screen.getByText('(vous)')).toBeInTheDocument();
  });

  it('sends an invitation from the modal', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue({
      ...members[2]!,
      id: 'new',
      email: 'dave@acme.test',
      invitationSent: true,
    });
    render(<TeamSettings currentUser={{ id: 'owner-1', role: 'owner' }} />);
    await screen.findByText('carol@acme.test');

    fireEvent.click(screen.getByRole('button', { name: /Inviter un membre/ }));
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'dave@acme.test' } });
    fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: 'Dave' } });
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));

    await waitFor(() =>
      expect(usersApi.invite).toHaveBeenCalledWith({ email: 'dave@acme.test', name: 'Dave', role: 'member' }),
    );
  });

  it('shows members read-only to non-admins', async () => {
    render(<TeamSettings currentUser={{ id: 'member-1', role: 'member' }} />);
    await screen.findByText('carol@acme.test');

    expect(screen.queryByRole('button', { name: /Inviter un membre/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
  });

  it('does not let an admin edit or remove the owner', async () => {
    render(<TeamSettings currentUser={{ id: 'admin-1', role: 'admin' }} />);
    await screen.findByText('carol@acme.test');

    // Only Carol (member) is editable: one role selector, one remove button
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Retirer' })).toHaveLength(1);
  });
});
