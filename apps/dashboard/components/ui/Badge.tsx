/**
 * Badge Component
 * Badge coloré pour statuts, sévérité, etc.
 */

import { ReactNode } from 'react';
import type { TicketStatus, TicketSeverity, TicketType } from '@/lib/types/ticket';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// Status Badge
interface StatusBadgeProps {
  status: TicketStatus;
}

const statusConfig: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
  new: { label: 'Nouveau', variant: 'info' },
  open: { label: 'Ouvert', variant: 'warning' },
  in_progress: { label: 'En cours', variant: 'info' },
  resolved: { label: 'Résolu', variant: 'success' },
  closed: { label: 'Fermé', variant: 'default' },
  analyzing: { label: 'Analyse...', variant: 'warning' },
  analyzed: { label: 'Analysé', variant: 'success' },
  analysis_failed: { label: 'Échec analyse', variant: 'danger' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'default' as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Severity Badge
interface SeverityBadgeProps {
  severity: TicketSeverity;
  showIcon?: boolean;
}

const severityConfig: Record<TicketSeverity, { label: string; variant: BadgeVariant; icon: string }> = {
  critical: { label: 'Critique', variant: 'default', icon: '🔴' },
  high: { label: 'Élevée', variant: 'warning', icon: '🟠' },
  medium: { label: 'Moyenne', variant: 'info', icon: '🟡' },
  low: { label: 'Faible', variant: 'danger', icon: '🟢' },
};

export function SeverityBadge({ severity, showIcon = true }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  return (
    <Badge variant={config.variant}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

// Type Badge
interface TypeBadgeProps {
  type: TicketType;
}

const typeConfig: Record<TicketType, { label: string; icon: string }> = {
  bug: { label: 'Bug', icon: '🐛' },
  crash: { label: 'Crash', icon: '💥' },
  performance: { label: 'Performance', icon: '⚡' },
  ui: { label: 'Interface', icon: '🎨' },
  feature_request: { label: 'Fonctionnalité', icon: '✨' },
  other: { label: 'Autre', icon: '📝' },
};

export function TypeBadge({ type }: TypeBadgeProps) {
  const config = typeConfig[type];
  return (
    <Badge variant="default">
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
