'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Modal, Input, Select, Button } from '@/components/ui';
import { ticketsApi } from '@/lib/api/tickets';
import { applicationsApi } from '@/lib/api/applications';
import type { Application } from '@/lib/types/application';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Manual ticket creation, for issues reported outside the SDK (phone, email...). */
export function NewTicketModal({ isOpen, onClose }: NewTicketModalProps) {
  const t = useTranslations('tickets.newTicket');
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState({ title: '', description: '', applicationId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    applicationsApi
      .getApplications()
      .then((apps) => {
        setApplications(apps);
        const first = apps[0];
        setForm((f) => (f.applicationId || !first ? f : { ...f, applicationId: first.id }));
      })
      .catch(() => toast.error(t('loadAppsError')));
  }, [isOpen, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ticket = await ticketsApi.createTicket({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        applicationId: form.applicationId,
      });
      toast.success(t('created'));
      setForm({ title: '', description: '', applicationId: form.applicationId });
      onClose();
      router.push(`/dashboard/tickets/${ticket.id}`);
    } catch {
      toast.error(t('error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('help')}</p>
        <Select
          label={t('application')}
          required
          value={form.applicationId}
          onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
          options={applications.map((app) => ({ value: app.id, label: app.name }))}
        />
        <Input
          label={t('ticketTitle')}
          required
          maxLength={500}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={t('titlePlaceholder')}
        />
        <div>
          <label htmlFor="new-ticket-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('description')}
          </label>
          <textarea
            id="new-ticket-description"
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('descriptionPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!form.applicationId || !form.title.trim()}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
