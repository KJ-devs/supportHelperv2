'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ticketKeys } from './use-tickets';
import { useToast } from './use-toast';
import type { NewTicketInput } from '@/lib/validations/ticket';

// Storage key for form draft
const DRAFT_STORAGE_KEY = 'new-ticket-draft';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

// Types
export interface CreateTicketResponse {
  id: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  applicationId: string;
  reproductionSteps: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

export interface ApplicationsResponse {
  data: Application[];
  total: number;
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  similarTickets?: Array<{
    id: string;
    title: string;
    similarity: number;
  }>;
}

// API functions
async function createTicket(input: NewTicketInput): Promise<CreateTicketResponse> {
  // Map the form input to the API's expected format
  const payload = {
    title: input.title,
    description: input.description,
    applicationId: input.applicationId,
    reproductionSteps: input.reproductionSteps.filter(step => step.trim()),
    // Store type and severity in userContext for now (until API schema is updated)
    userContext: {
      type: input.type,
      severity: input.severity,
      attachments: input.attachments.map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        url: a.url,
      })),
    },
  };

  return api.post<CreateTicketResponse>('/api/tickets', payload);
}

async function checkDuplicateTitle(title: string): Promise<DuplicateCheckResponse> {
  if (!title || title.length < 5) {
    return { isDuplicate: false };
  }
  return api.post<DuplicateCheckResponse>('/tickets/check-duplicate', { title });
}

async function fetchApplications(): Promise<ApplicationsResponse> {
  return api.get<ApplicationsResponse>('/applications');
}

async function uploadFile(file: File): Promise<{ url: string; id: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/uploads`,
    {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload file');
  }

  return response.json();
}

// Hook for creating a ticket with optimistic updates
export function useCreateTicketMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: createTicket,
    onMutate: async newTicket => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.lists() });

      // Snapshot the previous value
      const previousTickets = queryClient.getQueryData(ticketKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData(ticketKeys.lists(), (old: unknown) => {
        const oldData = old as { data: unknown[] } | undefined;
        if (!oldData?.data) return old;
        return {
          ...oldData,
          data: [
            {
              id: 'temp-' + Date.now(),
              ...newTicket,
              status: 'open',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...oldData.data,
          ],
        };
      });

      return { previousTickets };
    },
    onError: (err, _newTicket, context) => {
      // Roll back on error
      if (context?.previousTickets) {
        queryClient.setQueryData(ticketKeys.lists(), context.previousTickets);
      }
      toast({
        title: 'Error creating ticket',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    },
    onSuccess: data => {
      // Clear the draft from localStorage
      clearDraft();

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });

      toast({
        title: 'Ticket created!',
        description: `Ticket "${data.title}" has been created successfully.`,
      });

      // Redirect to the new ticket
      router.push(`/tickets/${data.id}`);
    },
  });
}

// Hook for checking duplicate titles (async validation)
export function useDuplicateCheck(title: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticket-duplicate-check', title],
    queryFn: () => checkDuplicateTitle(title),
    enabled: enabled && title.length >= 5,
    staleTime: 60 * 1000, // 1 minute
    retry: false,
  });
}

// Hook for fetching applications
export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: fetchApplications,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for file uploads
export function useFileUpload() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: uploadFile,
    onError: err => {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload file',
        variant: 'destructive',
      });
    },
  });
}

// Draft management functions
export function saveDraft(data: Partial<NewTicketInput>) {
  if (typeof window === 'undefined') return;

  try {
    // Don't save File objects to localStorage
    const dataToSave = {
      ...data,
      attachments: data.attachments?.map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        url: a.url,
      })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
}

export function loadDraft(): (Partial<NewTicketInput> & { savedAt?: string }) | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

export function clearDraft() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function hasDraft(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DRAFT_STORAGE_KEY) !== null;
}

// Hook for auto-save functionality
export function useAutoSave(
  getData: () => Partial<NewTicketInput>,
  interval: number = AUTO_SAVE_INTERVAL
) {
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string>('');

  const saveNow = useCallback(() => {
    const data = getData();
    const serialized = JSON.stringify(data);

    // Only save if data has changed
    if (serialized !== lastSaveRef.current) {
      saveDraft(data);
      lastSaveRef.current = serialized;
      return true;
    }
    return false;
  }, [getData]);

  useEffect(() => {
    // Set up interval for auto-save
    intervalRef.current = setInterval(() => {
      const saved = saveNow();
      if (saved) {
        toast({
          title: 'Draft saved',
          description: 'Your progress has been automatically saved.',
          duration: 2000,
        });
      }
    }, interval);

    // Save on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      saveNow();
    };
  }, [saveNow, interval, toast]);

  return { saveNow };
}
