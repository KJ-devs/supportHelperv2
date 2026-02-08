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

const newTicketSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.string().min(1, 'Please select a category'),
  customerEmail: z.string().email('Invalid email address'),
});

export function NewTicketForm() {
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
      category: '',
      customerEmail: '',
    },
    onSubmit: async ({ value }) => {
      // TODO: Implement actual ticket creation
      console.log('Create ticket:', value);
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/tickets');
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
        <form.Field name="priority">
          {field => (
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={field.state.value}
                onValueChange={value =>
                  field.handleChange(value as 'low' | 'medium' | 'high' | 'urgent')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field
          name="category"
          validators={{
            onChange: newTicketSchema.shape.category,
          }}
        >
          {field => (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={field.state.value} onValueChange={field.handleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field
        name="customerEmail"
        validators={{
          onChange: newTicketSchema.shape.customerEmail,
        }}
      >
        {field => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Customer Email</Label>
            <Input
              id={field.name}
              type="email"
              placeholder="customer@example.com"
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

      <div className="flex gap-4">
        <form.Subscribe selector={state => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
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
