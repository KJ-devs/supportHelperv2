/**
 * Ticket Detail Component
 * Affichage détaillé d'un ticket
 */

'use client';

import { useState } from 'react';
import type { Ticket, TicketStatus } from '@/lib/types/ticket';
import { ticketsApi } from '@/lib/api/tickets';
import { StatusBadge, SeverityBadge, TypeBadge, Button, Select, Card } from '@/components/ui';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { Bot, Monitor } from 'lucide-react';

interface TicketDetailProps {
  ticket: Ticket;
  onUpdate: (ticket: Ticket) => void;
}

export function TicketDetail({ ticket, onUpdate }: TicketDetailProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});

  // Fetch pre-signed URL for a media item
  const fetchMediaUrl = async (mediaId: string) => {
    if (mediaUrls[mediaId] || loadingUrls[mediaId]) return;

    setLoadingUrls(prev => ({ ...prev, [mediaId]: true }));

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      const response = await fetch(`${API_URL}/api/media/${mediaId}/url`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch media URL: ${response.statusText}`);
      }

      const data = await response.json();
      setMediaUrls(prev => ({ ...prev, [mediaId]: data.url }));
    } catch (error) {
      console.error('Error fetching media URL:', error);
    } finally {
      setLoadingUrls(prev => ({ ...prev, [mediaId]: false }));
    }
  };

  // Helper to get filename from metadata or storageKey
  const getFilename = (media: any) => {
    return media.metadata?.originalFilename || media.storageKey.split('/').pop() || 'video';
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      setIsUpdating(true);
      const updated = await ticketsApi.updateStatus(ticket.id, newStatus);
      onUpdate(updated);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors de la mise à jour du statut');
    } finally {
      setIsUpdating(false);
    }
  };

  const createdAt = new Date(ticket.createdAt).toLocaleString('fr-FR');
  const updatedAt = new Date(ticket.updatedAt).toLocaleString('fr-FR');

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{ticket.title}</h1>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={ticket.status} />
              <TypeBadge type={ticket.type} />
              <SeverityBadge severity={ticket.severity} />
            </div>
          </div>

          {/* Status Changer */}
          <div className="ml-4" style={{ minWidth: '200px' }}>
            <Select
              label="Changer le statut"
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              disabled={isUpdating}
              options={[
                { value: 'new', label: 'Nouveau' },
                { value: 'open', label: 'Ouvert' },
                { value: 'in_progress', label: 'En cours' },
                { value: 'resolved', label: 'Résolu' },
                { value: 'closed', label: 'Fermé' },
              ]}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Créé le</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{createdAt}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mis à jour</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{updatedAt}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Application</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {ticket.application?.name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID</p>
            <p className="text-sm font-mono text-gray-600 dark:text-gray-400 truncate" title={ticket.id}>
              {ticket.id.substring(0, 8)}...
            </p>
          </div>
        </div>
      </Card>

      {/* Description Card */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">📝 Description</h2>
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
      </Card>

      {/* AI Analysis Card */}
      {ticket.aiSummary && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Bot className="w-5 h-5" aria-hidden="true" />
            Analyse IA
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Résumé</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                {ticket.aiSummary}
              </p>
            </div>

            {ticket.keywords && ticket.keywords.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mots-clés</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ticket.aiAnalysis && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Analyse détaillée</p>
                <pre className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded overflow-x-auto">
                  {JSON.stringify(ticket.aiAnalysis, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* User Context Card */}
      {ticket.userContext && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Monitor className="w-5 h-5" aria-hidden="true" />
            Contexte Utilisateur
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(ticket.userContext).map(([key, value]) => (
              <div key={key} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Media Card */}
      {ticket.media && ticket.media.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">🎥 Médias</h2>
          <div className="space-y-4">
            {ticket.media.map((media) => {
              const filename = getFilename(media);
              const fileSize = typeof media.fileSize === 'bigint' ? Number(media.fileSize) : (media.fileSize || 0);
              const isVideo = media.type === 'video' || media.mimeType?.startsWith('video/');

              return (
                <div key={media.id}>
                  {media.processingStatus === 'completed' && isVideo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{filename}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {media.type} • {(fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      {mediaUrls[media.id] ? (
                        <VideoPlayer
                          src={mediaUrls[media.id]!}
                          title={filename}
                          mimeType={media.mimeType ?? undefined}
                          onError={(error) => console.error('Video error:', error)}
                        />
                      ) : (
                        <div className="border dark:border-gray-700 rounded-lg p-8 text-center bg-gray-50 dark:bg-gray-800">
                          {loadingUrls[media.id] ? (
                            <div className="space-y-2">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Loading video...</p>
                            </div>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => fetchMediaUrl(media.id)}
                            >
                              Load Video
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{filename}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {media.type} • {(fileSize / 1024 / 1024).toFixed(2)} MB •{' '}
                            {media.processingStatus}
                          </p>
                        </div>
                        {(media.processingStatus === 'uploaded' || media.processingStatus === 'completed') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              await fetchMediaUrl(media.id);
                              const url = mediaUrls[media.id];
                              if (url) {
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }
                            }}
                            disabled={loadingUrls[media.id]}
                          >
                            {loadingUrls[media.id] ? '...' : '📥 Télécharger'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
