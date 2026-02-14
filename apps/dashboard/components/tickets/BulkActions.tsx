/**
 * Bulk Actions Component
 * Actions en masse sur plusieurs tickets selectionnes
 */

'use client';

import { useState, useEffect } from 'react';
import { Button, Select, Modal } from '@/components/ui';
import type { TicketStatus, TicketSeverity } from '@/lib/types/ticket';
import { ticketsApi } from '@/lib/api/tickets';
import { usersApi, type User } from '@/lib/api/users';

type BulkActionType = 'status' | 'assign' | 'unassign' | 'severity' | 'delete' | '';

interface BulkActionsProps {
  selectedTickets: string[];
  onComplete: () => void;
  onCancel: () => void;
}

interface BulkResult {
  processed: number;
  failed: number;
  errors: string[];
}

export function BulkActions({ selectedTickets, onComplete, onCancel }: BulkActionsProps) {
  const [action, setAction] = useState<BulkActionType>('');
  const [newStatus, setNewStatus] = useState<TicketStatus>('open');
  const [newSeverity, setNewSeverity] = useState<TicketSeverity>('medium');
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  // Users for assignment
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Fetch users when assign action is selected
  useEffect(() => {
    if (action === 'assign' && users.length === 0) {
      setUsersLoading(true);
      usersApi
        .getUsers()
        .then((data) => {
          setUsers(data);
          const firstUser = data[0];
          if (firstUser) {
            setAssignUserId(firstUser.id);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch users:', err);
        })
        .finally(() => setUsersLoading(false));
    }
  }, [action, users.length]);

  const getActionLabel = (): string => {
    switch (action) {
      case 'status':
        return 'Change Status';
      case 'assign':
        return 'Assign to User';
      case 'unassign':
        return 'Unassign';
      case 'severity':
        return 'Change Severity';
      case 'delete':
        return 'Delete';
      default:
        return '';
    }
  };

  const getActionValue = (): any => {
    switch (action) {
      case 'status':
        return newStatus;
      case 'assign':
        return assignUserId;
      case 'severity':
        return newSeverity;
      default:
        return undefined;
    }
  };

  const isActionReady = (): boolean => {
    if (!action) return false;
    if (action === 'assign' && !assignUserId) return false;
    return true;
  };

  const handleExecuteClick = () => {
    if (!isActionReady()) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setIsProcessing(true);
    setResult(null);

    try {
      const bulkResult = await ticketsApi.bulkAction(
        selectedTickets,
        action,
        getActionValue()
      );
      setResult(bulkResult);

      // Auto-close on full success after a short delay
      if (bulkResult.failed === 0) {
        setTimeout(() => {
          setResult(null);
          onComplete();
        }, 1500);
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      setResult({
        processed: 0,
        failed: selectedTickets.length,
        errors: ['An unexpected error occurred'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismissResult = () => {
    setResult(null);
    onComplete();
  };

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Selection Info */}
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
            <span className="font-medium text-blue-900">
              {selectedTickets.length} ticket(s) selected
            </span>
          </div>

          {/* Action Selector */}
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value as BulkActionType);
              setResult(null);
            }}
            disabled={isProcessing}
            options={[
              { value: '', label: 'Choose an action...' },
              { value: 'status', label: 'Change Status' },
              { value: 'assign', label: 'Assign to User' },
              { value: 'unassign', label: 'Unassign' },
              { value: 'severity', label: 'Change Severity' },
              { value: 'delete', label: 'Delete' },
            ]}
          />

          {/* Status Selector */}
          {action === 'status' && (
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
              disabled={isProcessing}
              options={[
                { value: 'new', label: 'New' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          )}

          {/* Severity Selector */}
          {action === 'severity' && (
            <Select
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as TicketSeverity)}
              disabled={isProcessing}
              options={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          )}

          {/* User Selector for Assign */}
          {action === 'assign' && (
            <Select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              disabled={isProcessing || usersLoading}
              options={
                usersLoading
                  ? [{ value: '', label: 'Loading users...' }]
                  : users.length === 0
                  ? [{ value: '', label: 'No users available' }]
                  : users.map((u) => ({
                      value: u.id,
                      label: u.name || u.email,
                    }))
              }
            />
          )}

          {/* Delete Warning */}
          {action === 'delete' && (
            <span className="text-sm text-red-600 font-medium">
              Irreversible action!
            </span>
          )}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={action === 'delete' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleExecuteClick}
              disabled={!isActionReady() || isProcessing}
              isLoading={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Apply'}
            </Button>
          </div>
        </div>

        {/* Result Summary */}
        {result && (
          <div
            className={`mt-3 p-3 rounded-md text-sm ${
              result.failed === 0
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>
                {result.processed} ticket(s) processed successfully
                {result.failed > 0 && `, ${result.failed} failed`}
              </span>
              {result.failed > 0 && (
                <Button variant="ghost" size="sm" onClick={handleDismissResult}>
                  Dismiss
                </Button>
              )}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs">
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>...and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Bulk Action"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant={action === 'delete' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleConfirm}
            >
              {action === 'delete' ? 'Delete' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          {action === 'delete' ? (
            <>
              Are you sure you want to <strong>delete</strong>{' '}
              {selectedTickets.length} ticket(s)? This action cannot be undone.
            </>
          ) : (
            <>
              Apply <strong>{getActionLabel()}</strong> to{' '}
              {selectedTickets.length} ticket(s)?
            </>
          )}
        </p>
      </Modal>
    </>
  );
}
