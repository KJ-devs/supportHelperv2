/**
 * Tests for AI Settings page
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AiSettingsPage from './page';
import { aiConfigApi } from '@/lib/api/ai-config';
import type { AiConfigResponse } from '@/lib/types/ai-config';

// Mock auth
vi.mock('@/lib/auth', () => ({
  useRequireAuth: () => ({ isLoading: false, user: { id: '1', email: 'test@test.com' } }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock AI config API
vi.mock('@/lib/api/ai-config', () => ({
  aiConfigApi: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    testConnection: vi.fn(),
    validateKey: vi.fn(),
  },
}));

// Mock DashboardLayout to avoid complex rendering
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

// Mock useToast from ui components
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    useToast: () => ({
      addToast: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    }),
  };
});

const mockConfigNotConfigured: AiConfigResponse = {
  configured: false,
  provider: 'anthropic',
  maskedApiKey: null,
  model: 'claude-sonnet-4-6',
  settings: {},
};

const mockConfigConfigured: AiConfigResponse = {
  configured: true,
  id: 'cfg-1',
  provider: 'anthropic',
  maskedApiKey: 'sk-ant-...xyz',
  model: 'claude-sonnet-4-6',
  settings: {},
  updatedAt: '2026-01-01T12:00:00Z',
};

describe('AiSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiConfigApi.getConfig).mockResolvedValue(mockConfigNotConfigured);
  });

  it('shows page loader while loading', () => {
    vi.mocked(aiConfigApi.getConfig).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    render(<AiSettingsPage />);
    // PageLoader renders with role="status"
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the page title after loading', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      // Use getAllByText since "AI Configuration" appears in breadcrumb AND h1
      expect(screen.getAllByText('AI Configuration').length).toBeGreaterThan(0);
    });
  });

  it('shows "Using platform default" when not configured', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Using platform default')).toBeInTheDocument();
    });
  });

  it('shows "Connected" banner when configured', async () => {
    vi.mocked(aiConfigApi.getConfig).mockResolvedValue(mockConfigConfigured);
    render(<AiSettingsPage />);
    await waitFor(() => {
      // The banner shows "Connected — Anthropic"
      const connectedText = screen.getByText(/Connected — Anthropic/i);
      expect(connectedText).toBeInTheDocument();
    });
  });

  it('renders all provider options', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Google Gemini')).toBeInTheDocument();
      expect(screen.getByText('AWS Bedrock')).toBeInTheDocument();
      expect(screen.getByText('Ollama (Local)')).toBeInTheDocument();
    });
  });

  it('shows API Key field for Anthropic by default', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });
  });

  it('shows Model selector for Anthropic', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Model')).toBeInTheDocument();
    });
  });

  it('shows Endpoint URL field when Ollama is selected', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Ollama (Local)')).toBeInTheDocument();
    });

    // Find and click the Ollama provider button (it's in the provider grid)
    const allButtons = screen.getAllByRole('button');
    const ollamaButton = allButtons.find((btn) =>
      btn.textContent?.includes('Ollama (Local)') && btn.textContent?.includes('Run open-source')
    );
    expect(ollamaButton).toBeTruthy();
    fireEvent.click(ollamaButton!);

    await waitFor(() => {
      expect(screen.getByText('Endpoint URL')).toBeInTheDocument();
    });
  });

  it('shows AWS Region field when Bedrock is selected', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('AWS Bedrock')).toBeInTheDocument();
    });

    const allButtons = screen.getAllByRole('button');
    const bedrockButton = allButtons.find((btn) =>
      btn.textContent?.includes('AWS Bedrock') && btn.textContent?.includes('Claude models via AWS')
    );
    expect(bedrockButton).toBeTruthy();
    fireEvent.click(bedrockButton!);

    await waitFor(() => {
      expect(screen.getByText('AWS Region')).toBeInTheDocument();
    });
  });

  it('hides API Key field for Bedrock (no requiresApiKey)', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('AWS Bedrock')).toBeInTheDocument();
    });

    const allButtons = screen.getAllByRole('button');
    const bedrockButton = allButtons.find((btn) =>
      btn.textContent?.includes('AWS Bedrock') && btn.textContent?.includes('Claude models via AWS')
    );
    fireEvent.click(bedrockButton!);

    await waitFor(() => {
      expect(screen.queryByText('API Key')).not.toBeInTheDocument();
    });
  });

  it('toggles API key visibility when show button is clicked', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });

    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(passwordInput).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /show api key/i });
    fireEvent.click(toggleBtn);

    const textInput = document.querySelector('input[type="text"]');
    expect(textInput).toBeInTheDocument();
  });

  it('save button is disabled when form is invalid (no API key for provider requiring one)', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when API key is entered', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });

    const apiKeyInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-api03-testkey' } });

    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('renders Test Connection button', async () => {
    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    });
  });

  it('shows success message after successful connection test', async () => {
    vi.mocked(aiConfigApi.getConfig).mockResolvedValue(mockConfigConfigured);
    vi.mocked(aiConfigApi.testConnection).mockResolvedValue({ valid: true });

    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    });

    const testButton = screen.getByRole('button', { name: /test connection/i });
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Connection successful/i)).toBeInTheDocument();
    });
  });

  it('shows error message after failed connection test', async () => {
    vi.mocked(aiConfigApi.getConfig).mockResolvedValue(mockConfigConfigured);
    vi.mocked(aiConfigApi.testConnection).mockResolvedValue({
      valid: false,
      error: 'Invalid API key',
    });

    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });
  });

  it('calls aiConfigApi.updateConfig on form submit with API key', async () => {
    vi.mocked(aiConfigApi.updateConfig).mockResolvedValue(mockConfigConfigured);

    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });

    const apiKeyInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-api03-validkey' } });

    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(aiConfigApi.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          apiKey: 'sk-ant-api03-validkey',
        })
      );
    });
  });

  it('shows current config summary when provider is configured', async () => {
    vi.mocked(aiConfigApi.getConfig).mockResolvedValue(mockConfigConfigured);

    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Current Configuration')).toBeInTheDocument();
    });
    // Multiple elements may contain model name — verify at least one exists
    expect(screen.getAllByText(/claude-sonnet-4-6/).length).toBeGreaterThan(0);
  });

  it('shows masked API key in current config summary', async () => {
    vi.mocked(aiConfigApi.getConfig).mockResolvedValue(mockConfigConfigured);

    render(<AiSettingsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('sk-ant-...xyz').length).toBeGreaterThan(0);
    });
  });
});
