'use client';

import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCreateTicketMutation, useApplications } from '@/hooks/use-new-ticket-form';

const newTicketSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  type: z.enum(['bug', 'feature', 'ui', 'performance']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  applicationId: z.string().min(1, 'Please select an application'),
});

export function NewTicketForm() {
  const router = useRouter();
  const createTicket = useCreateTicketMutation();
  const { data: applications, isLoading: applicationsLoading } = useApplications();

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      type: 'bug' as 'bug' | 'feature' | 'ui' | 'performance',
      severity: 'medium' as 'critical' | 'high' | 'medium' | 'low',
      applicationId: '',
    },
    onSubmit: async ({ value }) => {
      // Create ticket with the mutation
      createTicket.mutate({
        ...value,
        reproductionSteps: [],
        attachments: [],
      });
    },
    validatorAdapter: zodValidator(),
  });

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <form.Field
        name="title"
        validators={{
          onChange: newTicketSchema.shape.title,
        }}
      >
        {field => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Title</Label>
            <Input
              id={field.name}
              placeholder="Brief description of the issue"
              value={field.state.value}
              onChange={e => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="description"
        validators={{
          onChange: newTicketSchema.shape.description,
        }}
      >
        {field => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Description</Label>
            <Textarea
              id={field.name}
              placeholder="Detailed description of the issue, steps to reproduce, etc."
              rows={6}
              value={field.state.value}
              onChange={e => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
            )}
          </div>
        )}
      </form.Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <form.Field name="type">
          {field => (
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={field.state.value}
                onValueChange={value =>
                  field.handleChange(value as 'bug' | 'feature' | 'ui' | 'performance')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="ui">UI/UX Issue</SelectItem>
                  <SelectItem value="performance">Performance Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="severity">
          {field => (
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={field.state.value}
                onValueChange={value =>
                  field.handleChange(value as 'critical' | 'high' | 'medium' | 'low')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      </div>

      <form.Field
        name="applicationId"
        validators={{
          onChange: newTicketSchema.shape.applicationId,
        }}
      >
        {field => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Application</Label>
            <Select
              value={field.state.value}
              onValueChange={field.handleChange}
              disabled={applicationsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select application" />
              </SelectTrigger>
              <SelectContent>
                {applications?.data?.map(app => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
            )}
          </div>
        )}
      </form.Field>

      <div className="flex gap-4">
        <form.Subscribe selector={state => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || createTicket.isPending}
            >
              {(isSubmitting || createTicket.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          )}
        </form.Subscribe>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
