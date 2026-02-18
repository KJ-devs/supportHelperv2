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

// API base URL for direct fetch calls (presigned upload)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  url?: string;
  platform?: string;
  sdkKey?: string;
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

// Map form type values to API type values
const TYPE_MAP: Record<string, string> = {
  bug: 'bug',
  feature: 'feature_request',
  ui: 'question', // closest match for UI/UX issues
  performance: 'performance',
};

// API functions

/**
 * Create a ticket via POST /api/tickets
 * The API uses userContext to store form-specific fields (type, severity, attachments)
 * since the createTicket schema only exposes title, description, applicationId, reproductionSteps
 */
async function createTicket(input: NewTicketInput): Promise<CreateTicketResponse> {
  const payload = {
    title: input.title,
    description: input.description,
    applicationId: input.applicationId,
    reproductionSteps: input.reproductionSteps.filter(step => step.trim()),
    userContext: {
      type: TYPE_MAP[input.type] ?? input.type,
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

/**
 * Check for duplicate titles
 * Falls back gracefully if the endpoint is not available
 */
async function checkDuplicateTitle(title: string): Promise<DuplicateCheckResponse> {
  if (!title || title.length < 5) {
    return { isDuplicate: false };
  }
  try {
    return await api.post<DuplicateCheckResponse>('/api/tickets/check-duplicate', { title });
  } catch {
    // Endpoint may not exist; return safe default
    return { isDuplicate: false };
  }
}

/**
 * Fetch applications for the current tenant from GET /api/applications
 * The API returns an array directly (not a paginated wrapper)
 */
async function fetchApplications(): Promise<ApplicationsResponse> {
  const apps = await api.get<Application[]>('/api/applications');
  return { data: Array.isArray(apps) ? apps : [], total: Array.isArray(apps) ? apps.length : 0 };
}

interface PresignedUrlResponse {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
  maxSize: number;
}

interface CompleteUploadResponse {
  id: string;
  url?: string;
  storageKey: string;
  status: string;
}

/**
 * Upload a file using the presigned URL flow:
 * 1. POST /api/media/presigned-url  -> get uploadUrl + mediaId + storageKey
 * 2. PUT uploadUrl                   -> upload file directly to S3/MinIO
 * 3. POST /api/media/complete        -> confirm upload, trigger AI analysis
 */
async function uploadFile(file: File): Promise<{ url: string; id: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  // Determine media type
  let mediaType: 'video' | 'image' | 'screenshot' = 'image';
  if (file.type.startsWith('video/')) {
    mediaType = 'video';
  } else if (file.type.startsWith('image/')) {
    mediaType = 'image';
  }

  // Validate that the file extension is supported
  const supportedExtensions = /\.(mp4|webm|mov|png|jpg|jpeg|gif)$/i;
  if (!supportedExtensions.test(file.name)) {
    throw new Error(
      `Unsupported file type. Allowed: mp4, webm, mov, png, jpg, jpeg, gif`
    );
  }

  // Step 1: Request presigned URL
  const presignedResponse = await fetch(`${API_URL}/api/media/presigned-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ticketId: '', // Will be linked later; providing empty for standalone uploads
      type: mediaType,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });

  if (!presignedResponse.ok) {
    const error = await presignedResponse.json().catch(() => ({ message: 'Failed to get upload URL' }));
    throw new Error(error.message || 'Failed to get upload URL');
  }

  const { mediaId, uploadUrl, storageKey }: PresignedUrlResponse = await presignedResponse.json();

  // Step 2: Upload file directly to S3/MinIO via presigned URL
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }

  // Step 3: Confirm upload completion
  const completeResponse = await fetch(`${API_URL}/api/media/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      mediaId,
      storageKey,
    }),
  });

  if (!completeResponse.ok) {
    const error = await completeResponse.json().catch(() => ({ message: 'Failed to complete upload' }));
    throw new Error(error.message || 'Failed to complete upload');
  }

  const completeData: CompleteUploadResponse = await completeResponse.json();

  return {
    id: completeData.id || mediaId,
    url: completeData.url || storageKey,
  };
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
        description: err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: data => {
      // Clear the draft from localStorage
      clearDraft();

      // Invalidate and refetch ticket list cache
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });

      toast({
        title: 'Ticket created successfully',
        description: `"${data.title}" has been submitted. Our team will review it shortly.`,
      });

      // Redirect to the new ticket detail page
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

// Hook for file uploads using the presigned URL flow
export function useFileUpload() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: uploadFile,
    onError: err => {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload file. Please try again.',
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
