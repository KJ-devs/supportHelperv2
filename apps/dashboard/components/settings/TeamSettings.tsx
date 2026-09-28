'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { UserPlus, Mail, Trash2 } from 'lucide-react';
import { Card, Button, Input, Select, Modal, ConfirmModal, Loader } from '@/components/ui';
import { usersApi, ApiError, type User, type TeamRole, type InviteUserData } from '@/lib/api/users';

interface TeamSettingsProps {
  currentUser: { id: string; role: string };
}

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  member: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const EMPTY_INVITE: InviteUserData = { email: '', name: '', role: 'member' };

export function TeamSettings({ currentUser }: TeamSettingsProps) {
  const t = useTranslations('settings.team');
  const canManage = currentUser.role === 'owner' || currentUser.role === 'admin';

  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteUserData>(EMPTY_INVITE);
  const [isInviting, setIsInviting] = useState(false);
  const [toRemove, setToRemove] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const load = useCallback(async () => {
    try {
      setMembers(await usersApi.getUsers());
    } catch {
      toast.error(t('loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const roleLabel = (role: string) => (['owner', 'admin', 'member'].includes(role) ? t(`roles.${role}`) : role);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const result = await usersApi.invite(invite);
      if (result.invitationSent) {
        toast.success(t('inviteSent', { email: result.email }));
      } else {
        toast.error(t('inviteNotSent'));
      }
      setInviteOpen(false);
      setInvite(EMPTY_INVITE);
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('inviteError'));
    } finally {
      setIsInviting(false);
    }
  };

  const handleResend = async (member: User) => {
    try {
      const { invitationSent } = await usersApi.resendInvitation(member.id);
      if (invitationSent) {
        toast.success(t('inviteSent', { email: member.email }));
      } else {
        toast.error(t('inviteNotSent'));
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('inviteError'));
    }
  };

  const handleRoleChange = async (member: User, role: TeamRole) => {
    try {
      await usersApi.updateRole(member.id, role);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)));
      toast.success(t('roleUpdated'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('roleError'));
    }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    setIsRemoving(true);
    try {
      await usersApi.remove(toRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== toRemove.id));
      toast.success(t('removed'));
      setToRemove(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('removeError'));
    } finally {
      setIsRemoving(false);
    }
  };

  // Admins cannot touch the owner; the owner can manage everyone but themselves
  const canEdit = (member: User) =>
    canManage && member.id !== currentUser.id && (member.role !== 'owner' || currentUser.role === 'owner');

  const assignableRoles = [
    { value: 'member', label: t('roles.member') },
    { value: 'admin', label: t('roles.admin') },
    ...(currentUser.role === 'owner' ? [{ value: 'owner', label: t('roles.owner') }] : []),
  ];

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
            {t('inviteMember')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {members.map((member) => (
            <li key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                  {(member.name || member.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {member.name || member.email}
                    {member.id === currentUser.id && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal"> ({t('you')})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{member.email}</p>
                  {member.invitationPending && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {t('pending')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canEdit(member) ? (
                  <select
                    aria-label={t('roleFor', { name: member.name || member.email })}
                    value={member.role}
                    onChange={(e) => handleRoleChange(member, e.target.value as TeamRole)}
                    className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${ROLE_BADGE[member.role] ?? ROLE_BADGE.member}`}>
                    {roleLabel(member.role)}
                  </span>
                )}

                {canManage && member.invitationPending && (
                  <button
                    type="button"
                    onClick={() => handleResend(member)}
                    title={t('resend')}
                    aria-label={t('resend')}
                    className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                {canEdit(member) && (
                  <button
                    type="button"
                    onClick={() => setToRemove(member)}
                    title={t('remove')}
                    aria-label={t('remove')}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
          {members.length <= 1 && (
            <li className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">{t('noOtherMembers')}</li>
          )}
        </ul>
      )}

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title={t('inviteTitle')}>
        <form onSubmit={handleInvite} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('inviteHelp')}</p>
          <Input
            label={t('email')}
            type="email"
            required
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            placeholder="colleague@company.com"
          />
          <Input
            label={t('name')}
            required
            value={invite.name}
            onChange={(e) => setInvite({ ...invite, name: e.target.value })}
          />
          <Select
            label={t('role')}
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value as InviteUserData['role'] })}
            options={[
              { value: 'member', label: `${t('roles.member')} — ${t('roleHelp.member')}` },
              { value: 'admin', label: `${t('roles.admin')} — ${t('roleHelp.admin')}` },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" isLoading={isInviting}>
              {t('sendInvite')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={toRemove !== null}
        onClose={() => setToRemove(null)}
        onConfirm={handleRemove}
        title={t('removeTitle')}
        message={t('removeMessage', { name: toRemove?.name || toRemove?.email || '' })}
        confirmLabel={t('remove')}
        variant="danger"
        isLoading={isRemoving}
      />
    </Card>
  );
}
