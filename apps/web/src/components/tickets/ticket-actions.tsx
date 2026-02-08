'use client';

import { ArrowLeft, Edit, Trash2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TicketActionsProps {
  ticketId: string;
}

export function TicketActions({ ticketId }: TicketActionsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Button variant="outline">
        <CheckCircle className="mr-2 h-4 w-4" />
        Mark Resolved
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Edit className="mr-2 h-4 w-4" />
            Edit Ticket
          </DropdownMenuItem>
          <DropdownMenuItem>Assign to me</DropdownMenuItem>
          <DropdownMenuItem>Change Priority</DropdownMenuItem>
          <DropdownMenuItem>Add Tags</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
