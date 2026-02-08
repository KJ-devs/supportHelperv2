import { type Metadata } from 'next';
import { AdvancedNewTicketForm } from '@/components/tickets/advanced-new-ticket-form';

export const metadata: Metadata = {
  title: 'New Ticket',
  description: 'Create a new support ticket',
};

export default function NewTicketPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Ticket</h1>
        <p className="text-muted-foreground">
          Submit a new support request with all relevant details. Your progress is automatically
          saved.
        </p>
      </div>

      <AdvancedNewTicketForm />
    </div>
  );
}
