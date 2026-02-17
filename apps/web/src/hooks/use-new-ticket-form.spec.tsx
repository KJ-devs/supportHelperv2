import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateTicketMutation, useApplications } from './use-new-ticket-form';
import * as apiModule from '@/lib/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock toast hook
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

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
  });

  it('should create a ticket successfully', async () => {
    const mockTicket = {
      id: '123',
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
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
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
  });

  it('should handle error when creating ticket fails', async () => {
    const mockError = new Error('Failed to create ticket');
    vi.spyOn(apiModule.api, 'post').mockRejectedValue(mockError);

    const { result } = renderHook(() => useCreateTicketMutation(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
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

  it('should fetch applications successfully', async () => {
    const mockApplications = {
      data: [
        { id: 'app-1', name: 'App 1', url: 'https://app1.com', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'app-2', name: 'App 2', url: 'https://app2.com', createdAt: '2024-01-01T00:00:00Z' },
      ],
      total: 2,
    };

    vi.spyOn(apiModule.api, 'get').mockResolvedValue(mockApplications);

    const { result } = renderHook(() => useApplications(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockApplications);
  });
});
