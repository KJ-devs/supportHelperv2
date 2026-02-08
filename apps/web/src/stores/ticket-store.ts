import { create } from 'zustand';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TicketFilters {
  status: TicketStatus | 'all';
  priority: TicketPriority | 'all';
  search: string;
  assignee: string | 'all';
  dateRange: { from: Date | null; to: Date | null };
}

interface TicketState {
  filters: TicketFilters;
  setFilter: <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => void;
  resetFilters: () => void;
}

const defaultFilters: TicketFilters = {
  status: 'all',
  priority: 'all',
  search: '',
  assignee: 'all',
  dateRange: { from: null, to: null },
};

export const useTicketStore = create<TicketState>(set => ({
  filters: defaultFilters,
  setFilter: (key, value) =>
    set(state => ({
      filters: { ...state.filters, [key]: value },
    })),
  resetFilters: () => set({ filters: defaultFilters }),
}));
