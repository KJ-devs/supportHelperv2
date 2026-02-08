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

interface TicketDetailProps {
  ticket: Ticket;
  onUpdate: (ticket: Ticket) => void;
}

export function TicketDetail({ ticket, onUpdate }: TicketDetailProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Helper to get media URL (construct from storageKey or API endpoint)
  const getMediaUrl = (storageKey: string) => {
    // TODO: Replace with actual pre-signed URL from API
    return `/api/media/download/${encodeURIComponent(storageKey)}`;
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{ticket.title}</h1>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-gray-500 mb-1">Créé le</p>
            <p className="text-sm font-medium">{createdAt}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Mis à jour</p>
            <p className="text-sm font-medium">{updatedAt}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Application</p>
            <p className="text-sm font-medium">
              {ticket.application?.name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">ID</p>
            <p className="text-sm font-mono text-gray-600 truncate" title={ticket.id}>
              {ticket.id.substring(0, 8)}...
            </p>
          </div>
        </div>
      </Card>

      {/* Description Card */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">📝 Description</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </Card>

      {/* AI Analysis Card */}
      {ticket.aiSummary && (
        <Card>
          <h2 className="text-lg font-semibold mb-3">🤖 Analyse IA</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Résumé</p>
              <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                {ticket.aiSummary}
              </p>
            </div>

            {ticket.keywords && ticket.keywords.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Mots-clés</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ticket.aiAnalysis && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Analyse détaillée</p>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
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
          <h2 className="text-lg font-semibold mb-3">💻 Contexte Utilisateur</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(ticket.userContext).map(([key, value]) => (
              <div key={key} className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500 mb-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-sm font-medium text-gray-900 break-all">
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
          <h2 className="text-lg font-semibold mb-3">🎥 Médias</h2>
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
                          <p className="text-sm font-medium">{filename}</p>
                          <p className="text-xs text-gray-500">
                            {media.type} • {(fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <VideoPlayer
                        src={getMediaUrl(media.storageKey)}
                        title={filename}
                        onError={(error) => console.error('Video error:', error)}
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{filename}</p>
                          <p className="text-xs text-gray-500">
                            {media.type} • {(fileSize / 1024 / 1024).toFixed(2)} MB •{' '}
                            {media.processingStatus}
                          </p>
                        </div>
                        {media.processingStatus === 'completed' && (
                          <a href={getMediaUrl(media.storageKey)} download={filename}>
                            <Button size="sm" variant="secondary">
                              📥 Télécharger
                            </Button>
                          </a>
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
