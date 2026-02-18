import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateTicketMutation,
  useApplications,
  useFileUpload,
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
} from './use-new-ticket-form';
import * as apiModule from '@/lib/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
  }),
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock global fetch for presigned URL flow
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Wrapper component for tests
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useCreateTicketMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockPush.mockClear();
    mockToast.mockClear();
  });

  it('should create a ticket successfully and redirect', async () => {
    const mockTicket = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Ticket',
      description: 'Test Description',
      type: 'bug',
      severity: 'high',
      applicationId: 'app-123',
      reproductionSteps: [],
      status: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    vi.spyOn(apiModule.api, 'post').mockResolvedValue(mockTicket);

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      title: 'Test Ticket',
      description: 'Test Description',
      type: 'bug',
      severity: 'high',
      applicationId: 'app-123',
      reproductionSteps: [],
      attachments: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTicket);
    expect(mockPush).toHaveBeenCalledWith(`/tickets/${mockTicket.id}`);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ticket created successfully' })
    );
  });

  it('should map form type "feature" to API type "feature_request"', async () => {
    const mockTicket = {
      id: 'ticket-456',
      title: 'Feature request',
      description: 'A feature',
      type: 'feature_request',
      severity: 'low',
      applicationId: 'app-456',
      reproductionSteps: [],
      status: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const postSpy = vi.spyOn(apiModule.api, 'post').mockResolvedValue(mockTicket);

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      title: 'Feature request',
      description: 'A feature',
      type: 'feature',
      severity: 'low',
      applicationId: 'app-456',
      reproductionSteps: [],
      attachments: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the payload sent to the API maps 'feature' -> 'feature_request'
    expect(postSpy).toHaveBeenCalledWith(
      '/api/tickets',
      expect.objectContaining({
        userContext: expect.objectContaining({ type: 'feature_request' }),
      })
    );
  });

  it('should filter empty reproduction steps before sending', async () => {
    const mockTicket = {
      id: 'ticket-789',
      title: 'Bug with steps',
      description: 'Details',
      type: 'bug',
      severity: 'medium',
      applicationId: 'app-789',
      reproductionSteps: ['Step 1', 'Step 2'],
      status: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const postSpy = vi.spyOn(apiModule.api, 'post').mockResolvedValue(mockTicket);

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      title: 'Bug with steps',
      description: 'Details',
      type: 'bug',
      severity: 'medium',
      applicationId: 'app-789',
      reproductionSteps: ['Step 1', '', 'Step 2', '  '],
      attachments: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(postSpy).toHaveBeenCalledWith(
      '/api/tickets',
      expect.objectContaining({
        reproductionSteps: ['Step 1', 'Step 2'],
      })
    );
  });

  it('should handle error when creating ticket fails', async () => {
    const mockError = new Error('Failed to create ticket');
    vi.spyOn(apiModule.api, 'post').mockRejectedValue(mockError);

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      title: 'Test Ticket',
      description: 'Test Description',
      type: 'bug',
      severity: 'high',
      applicationId: 'app-123',
      reproductionSteps: [],
      attachments: [],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error creating ticket',
        variant: 'destructive',
      })
    );
  });

  it('should show error message from API response', async () => {
    const mockError = new Error('Application not found');
    vi.spyOn(apiModule.api, 'post').mockRejectedValue(mockError);

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      title: 'Test Ticket',
      description: 'Test Description',
      type: 'bug',
      severity: 'high',
      applicationId: 'bad-id',
      reproductionSteps: [],
      attachments: [],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Application not found',
        variant: 'destructive',
      })
    );
  });

  it('should invalidate ticket list cache on success', async () => {
    const mockTicket = {
      id: 'ticket-abc',
      title: 'Cache test',
      description: 'Test',
      type: 'bug',
      severity: 'low',
      applicationId: 'app-1',
      reproductionSteps: [],
      status: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    vi.spyOn(apiModule.api, 'post').mockResolvedValue(mockTicket);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      title: 'Cache test',
      description: 'Test',
      type: 'bug',
      severity: 'low',
      applicationId: 'app-1',
      reproductionSteps: [],
      attachments: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['tickets']) })
    );
  });
});

describe('useApplications', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should fetch applications and wrap array in data/total structure', async () => {
    const mockAppsArray = [
      { id: 'app-1', name: 'App 1', platform: 'web', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'app-2', name: 'App 2', platform: 'mobile', createdAt: '2024-01-01T00:00:00Z' },
    ];

    vi.spyOn(apiModule.api, 'get').mockResolvedValue(mockAppsArray);

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      data: mockAppsArray,
      total: 2,
    });
  });

  it('should handle empty applications list', async () => {
    vi.spyOn(apiModule.api, 'get').mockResolvedValue([]);

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ data: [], total: 0 });
  });

  it('should handle fetch error gracefully', async () => {
    vi.spyOn(apiModule.api, 'get').mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useFileUpload', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockToast.mockClear();
  });

  it('should upload a file using the presigned URL flow', async () => {
    const mockFile = new File(['content'], 'screenshot.png', { type: 'image/png' });

    const presignedResponse = {
      mediaId: 'media-123',
      uploadUrl: 'https://s3.example.com/upload?signed=true',
      storageKey: 'tenant/ticket/media-123.png',
      expiresIn: 3600,
      maxSize: 10485760,
    };

    const completeResponse = {
      id: 'media-123',
      storageKey: 'tenant/ticket/media-123.png',
      status: 'completed',
      url: 'https://cdn.example.com/tenant/ticket/media-123.png',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => presignedResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => completeResponse,
      });

    const { result } = renderHook(() => useFileUpload(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(mockFile);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      id: 'media-123',
      url: 'https://cdn.example.com/tenant/ticket/media-123.png',
    });

    // Verify presigned URL request
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/media/presigned-url'),
      expect.objectContaining({ method: 'POST' })
    );

    // Verify S3 upload
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      presignedResponse.uploadUrl,
      expect.objectContaining({ method: 'PUT', body: mockFile })
    );

    // Verify completion call
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/api/media/complete'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should reject unsupported file types', async () => {
    const mockFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });

    const { result } = renderHook(() => useFileUpload(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(mockFile);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain('Unsupported file type');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('should show error toast when presigned URL request fails', async () => {
    const mockFile = new File(['content'], 'image.png', { type: 'image/png' });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Ticket not found' }),
    });

    const { result } = renderHook(() => useFileUpload(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(mockFile);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Upload failed',
        variant: 'destructive',
      })
    );
  });
});

describe('Draft management utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should save and load a draft', () => {
    const draftData = {
      title: 'My draft title',
      description: 'Draft description',
      type: 'bug' as const,
      severity: 'high' as const,
      applicationId: 'app-123',
      reproductionSteps: ['Step 1', 'Step 2'],
      attachments: [],
    };

    saveDraft(draftData);
    const loaded = loadDraft();

    expect(loaded).toBeTruthy();
    expect(loaded?.title).toBe('My draft title');
    expect(loaded?.severity).toBe('high');
    expect(loaded?.reproductionSteps).toEqual(['Step 1', 'Step 2']);
    expect(loaded?.savedAt).toBeDefined();
  });

  it('should return null when no draft exists', () => {
    expect(loadDraft()).toBeNull();
  });

  it('should clear a draft', () => {
    saveDraft({ title: 'Draft to clear' });
    expect(hasDraft()).toBe(true);

    clearDraft();

    expect(hasDraft()).toBe(false);
    expect(loadDraft()).toBeNull();
  });

  it('should not save File objects to draft (only metadata)', () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    const draftData = {
      title: 'With attachment',
      attachments: [
        {
          id: 'att-1',
          name: 'video.mp4',
          size: 1024,
          type: 'video/mp4',
          file,
        },
      ],
    };

    saveDraft(draftData);
    const loaded = loadDraft();

    expect(loaded?.attachments?.[0]).not.toHaveProperty('file');
    expect(loaded?.attachments?.[0]).toMatchObject({
      id: 'att-1',
      name: 'video.mp4',
      size: 1024,
      type: 'video/mp4',
    });
  });

  it('should report hasDraft correctly', () => {
    expect(hasDraft()).toBe(false);
    saveDraft({ title: 'test' });
    expect(hasDraft()).toBe(true);
    clearDraft();
    expect(hasDraft()).toBe(false);
  });
});
