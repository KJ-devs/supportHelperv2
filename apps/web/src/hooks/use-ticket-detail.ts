import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  TicketDetail,
  TicketPriority,
  UpdateTicketStatusInput,
  AssignTicketInput,
  CreateGitHubIssueInput,
  GitHubIssue,
  User,
} from '@/types/ticket';

// Query keys
export const ticketDetailKeys = {
  all: ['ticket-detail'] as const,
  detail: (id: string) => [...ticketDetailKeys.all, id] as const,
  users: () => ['users'] as const,
};

// Mock data for development
const createMockTicket = (id: string): TicketDetail => ({
  id,
  title: 'Cannot access dashboard after login',
  description: `After logging in successfully, I am redirected to the dashboard but see a blank white page.

The console shows a 403 error when trying to fetch user permissions. This started happening after the latest update.

I've tried:
- Clearing browser cache
- Using incognito mode
- Different browsers (Chrome, Firefox, Safari)

None of these worked. The issue persists across all browsers and devices.`,
  status: 'in_progress',
  priority: 'high',
  category: 'bug',
  severity: 'major',
  tags: ['authentication', 'dashboard', 'permissions', 'critical'],
  customer: {
    id: 'cust-1',
    email: 'john.doe@example.com',
    name: 'John Doe',
    avatar: null,
  },
  assignee: {
    id: 'agent-1',
    email: 'alice@support.com',
    name: 'Alice Johnson',
    avatar: null,
  },
  video: {
    id: 'vid-1',
    url: 'https://example.com/recordings/session-123.webm',
    duration: 154, // 2:34
    thumbnailUrl: null,
    events: [
      {
        id: 'evt-1',
        type: 'navigation',
        timestamp: 5,
        description: 'Navigated to /login',
        metadata: { url: '/login' },
      },
      {
        id: 'evt-2',
        type: 'input',
        timestamp: 12,
        description: 'Entered email in login form',
        metadata: { selector: '#email-input' },
      },
      {
        id: 'evt-3',
        type: 'input',
        timestamp: 18,
        description: 'Entered password',
        metadata: { selector: '#password-input' },
      },
      {
        id: 'evt-4',
        type: 'click',
        timestamp: 23,
        description: 'Clicked login button',
        metadata: { selector: '#login-submit' },
      },
      {
        id: 'evt-5',
        type: 'navigation',
        timestamp: 25,
        description: 'Redirected to /dashboard',
        metadata: { url: '/dashboard' },
      },
      {
        id: 'evt-6',
        type: 'network',
        timestamp: 26,
        description: 'API request failed: GET /api/user/permissions',
        metadata: { networkUrl: '/api/user/permissions', statusCode: 403 },
      },
      {
        id: 'evt-7',
        type: 'error',
        timestamp: 27,
        description: 'Uncaught Error: Permission denied',
        metadata: { errorMessage: 'User does not have required permissions' },
      },
      {
        id: 'evt-8',
        type: 'console',
        timestamp: 28,
        description: 'Console error: Failed to load user permissions',
      },
      {
        id: 'evt-9',
        type: 'scroll',
        timestamp: 45,
        description: 'User scrolled down the page',
      },
      {
        id: 'evt-10',
        type: 'click',
        timestamp: 68,
        description: 'Clicked refresh button',
        metadata: { selector: '#refresh-btn' },
      },
    ],
    ocrData: [
      { timestamp: 5, text: 'Welcome Back\nPlease sign in to continue' },
      { timestamp: 25, text: 'Dashboard\nLoading...' },
      { timestamp: 30, text: 'Error: Unable to load dashboard content' },
    ],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  screenshots: [],
  reproductionSteps: [
    {
      id: 'step-1',
      order: 1,
      action: 'Navigate to the login page',
      timestamp: 5,
    },
    {
      id: 'step-2',
      order: 2,
      action: 'Enter valid email and password credentials',
      timestamp: 12,
    },
    {
      id: 'step-3',
      order: 3,
      action: 'Click the login button',
      expected: 'User should be redirected to dashboard with data loaded',
      actual: 'User sees blank white page with console errors',
      timestamp: 23,
    },
    {
      id: 'step-4',
      order: 4,
      action: 'Open browser developer tools',
    },
    {
      id: 'step-5',
      order: 5,
      action: 'Check network tab and console',
      expected: 'Successful API responses',
      actual: '403 Forbidden error on /api/user/permissions',
      timestamp: 26,
    },
  ],
  logs: [
    {
      id: 'log-1',
      level: 'info',
      message: 'User authentication successful',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      source: 'auth-service',
    },
    {
      id: 'log-2',
      level: 'info',
      message: 'Redirecting to dashboard...',
      timestamp: new Date(Date.now() - 25 * 60 * 1000 + 1000).toISOString(),
      source: 'router',
    },
    {
      id: 'log-3',
      level: 'error',
      message: 'Failed to fetch user permissions: 403 Forbidden',
      timestamp: new Date(Date.now() - 25 * 60 * 1000 + 2000).toISOString(),
      source: 'permissions-service',
      stackTrace: `Error: Request failed with status 403
    at fetchPermissions (permissions.js:45:15)
    at async loadDashboard (dashboard.js:23:5)
    at async initApp (app.js:12:3)`,
    },
    {
      id: 'log-4',
      level: 'warn',
      message: 'Retrying permission fetch (attempt 2/3)',
      timestamp: new Date(Date.now() - 25 * 60 * 1000 + 5000).toISOString(),
      source: 'permissions-service',
    },
    {
      id: 'log-5',
      level: 'error',
      message: 'Max retries exceeded for permissions fetch',
      timestamp: new Date(Date.now() - 25 * 60 * 1000 + 10000).toISOString(),
      source: 'permissions-service',
    },
    {
      id: 'log-6',
      level: 'debug',
      message: 'User session data: { userId: "usr_123", role: "user", token: "***" }',
      timestamp: new Date(Date.now() - 25 * 60 * 1000 + 11000).toISOString(),
      source: 'debug',
    },
  ],
  aiAnalysis: {
    id: 'ai-1',
    summary:
      'The user is experiencing a 403 Forbidden error when the dashboard attempts to fetch user permissions after login. This appears to be a backend authorization issue rather than a frontend problem.',
    rootCause:
      "The user's permission token is not being properly validated by the backend service. This is likely due to a recent update that changed the permission validation logic.",
    suggestedSolution:
      'Check the backend permission validation service. Verify that the user token includes the correct scopes. Review recent changes to the auth middleware.',
    confidence: 0.87,
    relatedDocs: [
      {
        title: 'Permission System Documentation',
        url: 'https://docs.example.com/permissions',
        relevance: 0.92,
      },
      {
        title: 'Auth Token Troubleshooting',
        url: 'https://docs.example.com/auth/troubleshooting',
        relevance: 0.78,
      },
    ],
    codeSnippets: [
      {
        language: 'typescript',
        description: 'Check if user has required permissions',
        code: `// Verify token includes dashboard scope
const hasAccess = await verifyPermission(token, 'dashboard:read');
if (!hasAccess) {
  throw new ForbiddenError('Missing dashboard:read scope');
}`,
      },
    ],
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  githubIssue: null,
  similarTickets: [
    {
      id: 'similar-1',
      title: '403 error when accessing settings page',
      status: 'resolved',
      similarity: 0.89,
      resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'similar-2',
      title: 'Permission denied after password reset',
      status: 'resolved',
      similarity: 0.76,
      resolvedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'similar-3',
      title: 'Dashboard loads blank for new users',
      status: 'open',
      similarity: 0.72,
    },
  ],
  activityHistory: [
    {
      id: 'act-1',
      type: 'created',
      user: { id: 'cust-1', email: 'john@example.com', name: 'John Doe', avatar: null },
      message: 'Created this ticket',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-2',
      type: 'ai_analysis',
      user: { id: 'system', email: 'system@support.com', name: 'AI Assistant', avatar: null },
      message: 'AI analysis completed with 87% confidence',
      createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-3',
      type: 'assigned',
      user: { id: 'system', email: 'system@support.com', name: 'System', avatar: null },
      message: 'Auto-assigned to Alice Johnson based on expertise',
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-4',
      type: 'status_changed',
      user: { id: 'agent-1', email: 'alice@support.com', name: 'Alice Johnson', avatar: null },
      message: 'Changed status from open to in_progress',
      metadata: { from: 'open', to: 'in_progress' },
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-5',
      type: 'comment',
      user: { id: 'agent-1', email: 'alice@support.com', name: 'Alice Johnson', avatar: null },
      message:
        'Investigating the permission service logs. Can you confirm which user role you have?',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'act-6',
      type: 'tag_added',
      user: { id: 'agent-1', email: 'alice@support.com', name: 'Alice Johnson', avatar: null },
      message: 'Added tags: permissions, critical',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
  ],
  agentConversation: [
    {
      id: 'msg-1',
      role: 'user',
      content: "Hi, I can't access my dashboard after logging in. It just shows a blank page.",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      metadata: { sentiment: 'negative' },
    },
    {
      id: 'msg-2',
      role: 'agent',
      content:
        "I'm sorry to hear you're having trouble accessing your dashboard. I can see from the session recording that you're getting a 403 error. Let me look into this for you.",
      timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-3',
      role: 'system',
      content:
        'AI Analysis: High probability of permission token issue. Recommended escalation to backend team.',
      timestamp: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-4',
      role: 'agent',
      content:
        'I found the issue. It looks like there was a recent update to our permission system that may have affected your account. Can you tell me what user role you have? (Admin, User, or Guest)',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-5',
      role: 'user',
      content:
        "I'm a regular User role. I've had this account for about 6 months and it was working fine until today.",
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      metadata: { sentiment: 'neutral' },
    },
    {
      id: 'msg-6',
      role: 'agent',
      content:
        "Thank you for that information. I'm escalating this to our backend team now. In the meantime, I'll try refreshing your permission tokens. Can you try logging out and back in after 5 minutes?",
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      metadata: {
        suggestedActions: [
          'Escalate to backend',
          'Refresh user tokens',
          'Monitor for similar issues',
        ],
      },
    },
  ],
  browserInfo: {
    name: 'Chrome',
    version: '120.0.6099.109',
    os: 'macOS Sonoma 14.2',
  },
  pageUrl: 'https://app.example.com/dashboard',
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  events: [
    {
      id: 'tevt-1',
      type: 'fix_proposed',
      data: {
        prUrl: 'https://github.com/example/repo/pull/42',
        prNumber: 42,
        branch: 'fix/permission-token-validation',
        title: 'Fix permission token validation on dashboard load',
      },
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ],
});

const mockUsers: User[] = [
  { id: 'agent-1', email: 'alice@support.com', name: 'Alice Johnson', avatar: null },
  { id: 'agent-2', email: 'bob@support.com', name: 'Bob Smith', avatar: null },
  { id: 'agent-3', email: 'carol@support.com', name: 'Carol Williams', avatar: null },
];

// Fetch ticket detail
async function fetchTicketDetail(id: string): Promise<TicketDetail> {
  try {
    return await api.get<TicketDetail>(`/tickets/${id}/detail`);
  } catch {
    // Return mock data in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using mock ticket data for development');
      return createMockTicket(id);
    }
    throw new Error('Failed to fetch ticket');
  }
}

// Fetch available users for assignment
async function fetchUsers(): Promise<User[]> {
  try {
    return await api.get<User[]>('/users');
  } catch {
    if (process.env.NODE_ENV === 'development') {
      return mockUsers;
    }
    throw new Error('Failed to fetch users');
  }
}

// Update ticket status
async function updateTicketStatus({ id, status }: UpdateTicketStatusInput): Promise<TicketDetail> {
  return api.patch<TicketDetail>(`/tickets/${id}`, { status });
}

// Update ticket priority
async function updateTicketPriority({
  id,
  priority,
}: {
  id: string;
  priority: TicketPriority;
}): Promise<TicketDetail> {
  return api.patch<TicketDetail>(`/tickets/${id}`, { priority });
}

// Assign ticket
async function assignTicket({ id, assigneeId }: AssignTicketInput): Promise<TicketDetail> {
  return api.patch<TicketDetail>(`/tickets/${id}`, { assigneeId });
}

// Create GitHub issue
async function createGitHubIssue(input: CreateGitHubIssueInput): Promise<GitHubIssue> {
  return api.post<GitHubIssue>(`/tickets/${input.ticketId}/github-issue`, {
    repository: input.repository,
    title: input.title,
    labels: input.labels,
  });
}

// Hooks

export function useTicketDetail(id: string) {
  return useQuery({
    queryKey: ticketDetailKeys.detail(id),
    queryFn: () => fetchTicketDetail(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ticketDetailKeys.users(),
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTicketStatus,
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ticketDetailKeys.detail(id) });

      // Snapshot the previous value
      const previousTicket = queryClient.getQueryData<TicketDetail>(ticketDetailKeys.detail(id));

      // Optimistically update to the new value
      if (previousTicket) {
        queryClient.setQueryData<TicketDetail>(ticketDetailKeys.detail(id), {
          ...previousTicket,
          status,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousTicket };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousTicket) {
        queryClient.setQueryData(ticketDetailKeys.detail(id), context.previousTicket);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ticketDetailKeys.detail(id) });
    },
  });
}

export function useUpdateTicketPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTicketPriority,
    onMutate: async ({ id, priority }) => {
      await queryClient.cancelQueries({ queryKey: ticketDetailKeys.detail(id) });
      const previousTicket = queryClient.getQueryData<TicketDetail>(ticketDetailKeys.detail(id));

      if (previousTicket) {
        queryClient.setQueryData<TicketDetail>(ticketDetailKeys.detail(id), {
          ...previousTicket,
          priority,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousTicket };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousTicket) {
        queryClient.setQueryData(ticketDetailKeys.detail(id), context.previousTicket);
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketDetailKeys.detail(id) });
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignTicket,
    onMutate: async ({ id, assigneeId }) => {
      await queryClient.cancelQueries({ queryKey: ticketDetailKeys.detail(id) });
      const previousTicket = queryClient.getQueryData<TicketDetail>(ticketDetailKeys.detail(id));
      const users = queryClient.getQueryData<User[]>(ticketDetailKeys.users());

      if (previousTicket) {
        const assignee = assigneeId ? users?.find(u => u.id === assigneeId) || null : null;
        queryClient.setQueryData<TicketDetail>(ticketDetailKeys.detail(id), {
          ...previousTicket,
          assignee,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousTicket };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousTicket) {
        queryClient.setQueryData(ticketDetailKeys.detail(id), context.previousTicket);
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketDetailKeys.detail(id) });
    },
  });
}

export function useCreateGitHubIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGitHubIssue,
    onSuccess: (data, { ticketId }) => {
      // Update the ticket with the new GitHub issue
      const previousTicket = queryClient.getQueryData<TicketDetail>(
        ticketDetailKeys.detail(ticketId)
      );

      if (previousTicket) {
        queryClient.setQueryData<TicketDetail>(ticketDetailKeys.detail(ticketId), {
          ...previousTicket,
          githubIssue: data,
          updatedAt: new Date().toISOString(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ticketDetailKeys.detail(ticketId) });
    },
  });
}
