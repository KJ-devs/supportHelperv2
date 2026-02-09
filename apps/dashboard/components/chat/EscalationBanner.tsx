'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api/client';
import { ticketsApi } from '@/lib/api/tickets';

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface EscalationBannerProps {
  ticketId: string;
  reason?: string;
  escalatedTo?: string;
  onAssigned?: (userId: string) => void;
}

export function EscalationBanner({
  ticketId,
  reason,
  escalatedTo,
  onAssigned,
}: EscalationBannerProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(escalatedTo || '');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (showDropdown && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [showDropdown]);

  const fetchTeamMembers = async () => {
    try {
      setIsLoadingMembers(true);
      const members = await apiRequest<TeamMember[]>('/api/users');
      setTeamMembers(members);
    } catch {
      // Silently fail - dropdown just won't show members
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    try {
      setIsAssigning(true);
      await ticketsApi.assignTicket(ticketId, selectedUserId);
      onAssigned?.(selectedUserId);
      setShowDropdown(false);
    } catch {
      // Error handling done by parent
    } finally {
      setIsAssigning(false);
    }
  };

  const assignedMember = teamMembers.find((m) => m.id === escalatedTo);

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="flex items-start">
        <svg
          className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">
            This ticket has been escalated to human support.
          </p>
          {reason && (
            <p className="text-xs text-red-600 mt-0.5">Reason: {reason}</p>
          )}

          {/* Assigned info or assign dropdown */}
          <div className="mt-2">
            {escalatedTo && assignedMember ? (
              <p className="text-xs text-red-700">
                Assigned to: <span className="font-medium">{assignedMember.name || assignedMember.email}</span>
              </p>
            ) : !showDropdown ? (
              <button
                onClick={() => setShowDropdown(true)}
                className="text-xs text-red-700 underline hover:text-red-900"
              >
                Assign to team member
              </button>
            ) : (
              <div className="flex items-center space-x-2 mt-1">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isLoadingMembers || isAssigning}
                  className="text-xs border border-red-300 rounded px-2 py-1 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-400"
                >
                  <option value="">
                    {isLoadingMembers ? 'Loading...' : 'Select member'}
                  </option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email} ({member.role})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!selectedUserId || isAssigning}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </button>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
