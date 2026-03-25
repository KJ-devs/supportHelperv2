/**
 * ConfirmModal Component
 * Modal de confirmation réutilisable avec variante danger
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  const t = useTranslations('confirmModal');
  const resolvedConfirmLabel = confirmLabel ?? t('confirm');
  const resolvedCancelLabel = cancelLabel ?? t('cancel');

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isLoading}>
        {resolvedCancelLabel}
      </Button>
      <Button
        variant={variant === 'danger' ? 'danger' : 'primary'}
        onClick={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? t('inProgress') : resolvedConfirmLabel}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} size="sm">
      {typeof message === 'string' ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{message}</p>
      ) : (
        message
      )}
    </Modal>
  );
}
