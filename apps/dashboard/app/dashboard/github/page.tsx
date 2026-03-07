'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Badge, SeverityBadge, Modal, EmptyState } from '@/components/ui';
import { ConnectionStatus } from '@/components/github/ConnectionStatus';
import { RepoCard } from '@/components/github/RepoCard';
import { githubApi, type GitHubConnectionStatus, type GitHubRepo } from '@/lib/api/github';
import { ticketsApi } from '@/lib/api/tickets';
import type { Ticket } from '@/lib/types/ticket';

export default function GitHubPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <GitHubPageContent />
    </Suspense>
  );
}

function GitHubPageContent() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('github');
  const searchParams = useSearchParams();

  // Connection state
  const [connection, setConnection] = useState<GitHubConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  // Repos state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  // Tickets for user story section
  const [analyzedTickets, setAnalyzedTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [generatingStory, setGeneratingStory] = useState<string | null>(null);

  // User story repo selection
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storyTicketId, setStoryTicketId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Handle OAuth callback query params
  useEffect(() => {
    const githubParam = searchParams.get('github');
    const errorParam = searchParams.get('error');
    const userParam = searchParams.get('user');

    if (githubParam === 'connected') {
      showToast('success', userParam ? t('connectedAs', { user: userParam }) : t('connected'));
      window.history.replaceState({}, '', '/dashboard/github');
    } else if (errorParam) {
      showToast('error', t('connectionFailed', { error: errorParam }));
      window.history.replaceState({}, '', '/dashboard/github');
    }
  }, [searchParams, showToast, t]);

  // Fetch connection status
  const fetchConnectionStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const status = await githubApi.getConnectionStatus();
      setConnection(status);
      return status;
    } catch (err: any) {
      setError(err.message || t('fetchFailed'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Fetch repos
  const fetchRepos = useCallback(async () => {
    try {
      setReposLoading(true);
      const data = await githubApi.listRepos({ perPage: 30, sort: 'updated' });
      setRepos(data.repositories || []);
    } catch (err: any) {
      console.error('Failed to fetch repos:', err);
    } finally {
      setReposLoading(false);
    }
  }, []);

  // Fetch analyzed tickets (for user story generation)
  const fetchAnalyzedTickets = useCallback(async () => {
    try {
      setTicketsLoading(true);
      const response = await ticketsApi.getTickets({
        status: ['open', 'in_progress'],
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 20,
      });
      setAnalyzedTickets(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchConnectionStatus().then(status => {
        if (status?.connected) {
          fetchRepos();
          fetchAnalyzedTickets();
        }
      });
    }
  }, [authLoading, fetchConnectionStatus, fetchRepos, fetchAnalyzedTickets]);

  // Connect to GitHub
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const { url } = await githubApi.getAuthorizationUrl(window.location.href);
      window.location.href = url;
    } catch (err: any) {
      showToast('error', err.message || t('connectFailed'));
      setIsConnecting(false);
    }
  };

  // Disconnect from GitHub
  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await githubApi.disconnect();
      setConnection({ connected: false });
      setRepos([]);
      setAnalyzedTickets([]);
      setDisconnectConfirmOpen(false);
      showToast('success', t('disconnectedSuccess'));
    } catch (err: any) {
      showToast('error', err.message || t('disconnectFailed'));
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Generate user story
  const handleGenerateUserStory = async () => {
    if (!storyTicketId || !selectedRepo) return;

    try {
      setGeneratingStory(storyTicketId);
      setStoryModalOpen(false);
      const result = await githubApi.createUserStory(storyTicketId, {
        repository: selectedRepo,
      });
      showToast(
        'success',
        t('storyCreated', { number: result.issue.issueNumber, repo: result.issue.repository })
      );
    } catch (err: any) {
      showToast('error', err.message || t('storyFailed'));
    } finally {
      setGeneratingStory(null);
      setStoryTicketId(null);
      setSelectedRepo('');
    }
  };

  const openStoryModal = (ticketId: string) => {
    setStoryTicketId(ticketId);
    setSelectedRepo(repos.length > 0 ? repos[0]!.fullName : '');
    setStoryModalOpen(true);
  };

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{toast.type === 'success' ? 'OK' : '!'}</span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('subtitle')}</p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div>
                <h3 className="text-sm font-medium text-red-800">{t('error')}</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchConnectionStatus} className="ml-auto">
                {t('retry')}
              </Button>
            </div>
          </div>
        )}

        {/* A. Connection Status Card */}
        <div className="mb-6">
          <ConnectionStatus
            isConnected={connection?.connected ?? false}
            connectedAt={connection?.createdAt}
            onConnect={handleConnect}
            onDisconnect={() => setDisconnectConfirmOpen(true)}
            isConnecting={isConnecting}
            isDisconnecting={isDisconnecting}
          />
        </div>

        {/* Content only shown when connected */}
        {connection?.connected && (
          <>
            {/* B. Connected Repositories */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {t('repositories')}
                </h2>
                <Button variant="ghost" size="sm" onClick={fetchRepos} isLoading={reposLoading}>
                  {t('refresh')}
                </Button>
              </div>

              {reposLoading && repos.length === 0 ? (
                <Card>
                  <div className="text-center py-8">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-3" />
                    <p className="text-sm text-gray-500">{t('loadingRepos')}</p>
                  </div>
                </Card>
              ) : repos.length === 0 ? (
                <EmptyState icon="📚" title={t('noRepos')} description={t('noReposDescription')} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {repos.map(repo => (
                    <RepoCard
                      key={repo.id}
                      fullName={repo.fullName}
                      description={repo.description}
                      stars={repo.starCount}
                      issues={repo.openIssuesCount}
                      isPrivate={repo.private}
                      url={repo.url}
                      updatedAt={repo.updatedAt}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* D. User Story Generator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('userStories')}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('userStoriesSubtitle')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchAnalyzedTickets}
                  isLoading={ticketsLoading}
                >
                  {t('refresh')}
                </Button>
              </div>

              {ticketsLoading && analyzedTickets.length === 0 ? (
                <Card>
                  <div className="text-center py-8">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-3" />
                    <p className="text-sm text-gray-500">{t('loadingTickets')}</p>
                  </div>
                </Card>
              ) : analyzedTickets.length === 0 ? (
                <EmptyState
                  icon="🎫"
                  title={t('noTickets')}
                  description={t('noTicketsDescription')}
                  actionLabel={t('viewAllTickets')}
                  actionHref="/dashboard/tickets"
                />
              ) : (
                <Card padding={false}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('tableTicket')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('tableType')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('tableSeverity')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('tableStatus')}
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('tableAction')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analyzedTickets.map(ticket => (
                          <tr key={ticket.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                {ticket.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {ticket.id.substring(0, 8)}...
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge>{ticket.type}</Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <SeverityBadge severity={ticket.severity} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={ticket.status === 'in_progress' ? 'info' : 'warning'}>
                                {ticket.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Button
                                size="sm"
                                onClick={() => openStoryModal(ticket.id)}
                                isLoading={generatingStory === ticket.id}
                                disabled={generatingStory !== null}
                              >
                                {t('generateStory')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Disconnect Confirmation Modal */}
        <Modal
          isOpen={disconnectConfirmOpen}
          onClose={() => setDisconnectConfirmOpen(false)}
          title={t('disconnectTitle')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDisconnectConfirmOpen(false)}>
                {t('cancel')}
              </Button>
              <Button variant="danger" onClick={handleDisconnect} isLoading={isDisconnecting}>
                {t('disconnect')}
              </Button>
            </>
          }
        >
          <p className="text-gray-600 dark:text-gray-400">{t('disconnectMessage')}</p>
        </Modal>

        {/* User Story Repo Selection Modal */}
        <Modal
          isOpen={storyModalOpen}
          onClose={() => {
            setStoryModalOpen(false);
            setStoryTicketId(null);
            setSelectedRepo('');
          }}
          title={t('storyModalTitle')}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setStoryModalOpen(false);
                  setStoryTicketId(null);
                  setSelectedRepo('');
                }}
              >
                {t('cancel')}
              </Button>
              <Button onClick={handleGenerateUserStory} disabled={!selectedRepo}>
                {t('generate')}
              </Button>
            </>
          }
        >
          <div>
            <label htmlFor="repo-select" className="block text-sm font-medium text-gray-700 mb-2">
              {t('storyModalLabel')}
            </label>
            <select
              id="repo-select"
              value={selectedRepo}
              onChange={e => setSelectedRepo(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {repos.length === 0 && <option value="">{t('noReposAvailable')}</option>}
              {repos.map(repo => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">{t('storyModalHint')}</p>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
