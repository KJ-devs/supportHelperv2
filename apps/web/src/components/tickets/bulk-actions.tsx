'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  Trash2,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketStatus, TicketPriority, User } from '@/types';

export interface BulkActionsProps {
  selectedCount: number;
  onBulkAssign: (assigneeId: string) => void;
  onBulkUpdateStatus: (status: TicketStatus) => void;
  onBulkUpdatePriority: (priority: TicketPriority) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  assignees?: User[];
  isLoading?: boolean;
  className?: string;
}

export function BulkActions({
  selectedCount,
  onBulkAssign,
  onBulkUpdateStatus,
  onBulkUpdatePriority,
  onBulkDelete,
  onClearSelection,
  assignees = [],
  isLoading = false,
  className,
}: BulkActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showAssignDialog, setShowAssignDialog] = React.useState(false);
  const [selectedAssignee, setSelectedAssignee] = React.useState<string>('');

  if (selectedCount === 0) {
    return null;
  }

  const handleDelete = () => {
    onBulkDelete();
    setShowDeleteDialog(false);
  };

  const handleAssign = () => {
    if (selectedAssignee) {
      onBulkAssign(selectedAssignee);
      setShowAssignDialog(false);
      setSelectedAssignee('');
    }
  };

  return (
    <>
      <div className={cn('flex items-center gap-2 rounded-lg border bg-muted/50 p-2', className)}>
        <span className="text-sm font-medium">
          {selectedCount} ticket{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="flex items-center gap-1">
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Status
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onBulkUpdateStatus('open')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-blue-500" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdateStatus('in_progress')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdateStatus('resolved')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                Resolved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdateStatus('closed')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-gray-500" />
                Closed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Priority
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onBulkUpdatePriority('low')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-gray-400" />
                Low
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdatePriority('medium')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-blue-400" />
                Medium
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdatePriority('high')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-orange-400" />
                High
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdatePriority('urgent')}>
                <div className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                Urgent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assign button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => setShowAssignDialog(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign
          </Button>

          <div className="mx-2 h-6 w-px bg-border" />

          {/* Delete button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onClearSelection} className="ml-auto">
          <XCircle className="mr-2 h-4 w-4" />
          Clear selection
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} tickets?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected tickets and
              all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign dialog */}
      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign {selectedCount} tickets</AlertDialogTitle>
            <AlertDialogDescription>
              Select a team member to assign the selected tickets to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee..." />
              </SelectTrigger>
              <SelectContent>
                {assignees.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssign} disabled={!selectedAssignee}>
              Assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
