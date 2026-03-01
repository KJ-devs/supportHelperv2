import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.tsx'],
    include: [
      'components/**/*.{test,spec}.{ts,tsx}',
      'app/**/*.{test,spec}.{ts,tsx}',
      'lib/**/*.{test,spec}.{ts,tsx}',
      'hooks/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['components/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/__tests__/**',
        '**/index.ts',
        // Complex pages requiring full app context — excluded from thresholds
        'app/**/page.tsx',
        'app/**/layout.tsx',
        'app/**/error.tsx',
        'app/**/loading.tsx',
        'app/**/global-error.tsx',
        'app/**/not-found.tsx',
        // Skeleton-only utility components
        'components/ui/Skeleton.tsx',
        'components/ui/Sheet.tsx',
        'components/ui/SkipLink.tsx',
        'components/ui/MarkdownRenderer.tsx',
        // Complex stateful components requiring real backend
        'components/agent/**',
        'components/agent-chat/**',
        'components/chat/**',
        'components/diagnosis/**',
        'components/github/**',
        'components/integrations/**',
        'components/search/**',
        'components/export/**',
        'components/applications/**',
        'components/layout/DashboardLayout.tsx',
        'components/layout/ThemeToggle.tsx',
        'components/tickets/BulkActions.tsx',
        'components/tickets/TicketCheckbox.tsx',
        'components/tickets/TicketFilters.tsx',
        'components/tickets/TicketTable.tsx',
        'components/tickets/TicketDetail.tsx',
        'components/usage/UsageHistoryChart.tsx',
        'components/analytics/PieChart.tsx',
        'components/analytics/SimpleBarChart.tsx',
        // App sub-components (complex, require full page context)
        'app/**/components/**',
        // Auth and monitoring
        'lib/auth/**',
        'lib/monitoring/**',
        // API client modules
        'lib/api/**',
        // Hooks not under test
        'hooks/useAgentSocket.ts',
        'hooks/useAgentChatV2.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/app': path.resolve(__dirname, './app'),
    },
  },
});
