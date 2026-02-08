import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import type { TicketStatus, TicketPriority } from '@/types';

export interface TicketFiltersState {
  search: string;
  status: TicketStatus | 'all';
  priority: TicketPriority | 'all';
  type: string | 'all';
  severity: string | 'all';
  assigneeId: string | 'all' | 'unassigned';
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

export interface TicketSortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface TicketPaginationState {
  page: number;
  pageSize: number;
}

export interface TicketSelectionState {
  selectedIds: Set<string>;
  isAllSelected: boolean;
}

export interface TicketTableState {
  filters: TicketFiltersState;
  sort: TicketSortState;
  pagination: TicketPaginationState;
  selection: TicketSelectionState;
  columnVisibility: Record<string, boolean>;
  isFiltersPanelOpen: boolean;
  isFacetsSidebarOpen: boolean;
}

export interface TicketTableActions {
  // Filter actions
  setSearch: (search: string) => void;
  setStatus: (status: TicketStatus | 'all') => void;
  setPriority: (priority: TicketPriority | 'all') => void;
  setType: (type: string | 'all') => void;
  setSeverity: (severity: string | 'all') => void;
  setAssignee: (assigneeId: string | 'all' | 'unassigned') => void;
  setDateRange: (from: string | null, to: string | null) => void;
  resetFilters: () => void;

  // Sort actions
  setSort: (sortBy: string, sortOrder?: 'asc' | 'desc') => void;
  toggleSortOrder: () => void;

  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // Selection actions
  selectRow: (id: string) => void;
  deselectRow: (id: string) => void;
  toggleRow: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  toggleAll: (ids: string[]) => void;

  // Column visibility
  setColumnVisibility: (columnId: string, visible: boolean) => void;
  toggleColumn: (columnId: string) => void;

  // Panel actions
  toggleFiltersPanel: () => void;
  toggleFacetsSidebar: () => void;
  setFiltersPanelOpen: (open: boolean) => void;
  setFacetsSidebarOpen: (open: boolean) => void;
}

const initialFilters: TicketFiltersState = {
  search: '',
  status: 'all',
  priority: 'all',
  type: 'all',
  severity: 'all',
  assigneeId: 'all',
  dateRange: { from: null, to: null },
};

const initialSort: TicketSortState = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const initialPagination: TicketPaginationState = {
  page: 1,
  pageSize: 50,
};

const initialSelection: TicketSelectionState = {
  selectedIds: new Set(),
  isAllSelected: false,
};

const defaultColumnVisibility: Record<string, boolean> = {
  id: true,
  title: true,
  status: true,
  priority: true,
  type: true,
  customer: true,
  assignee: true,
  createdAt: true,
  actions: true,
};

export const useTicketTableStore = create<TicketTableState & TicketTableActions>()(
  devtools(
    persist(
      immer(set => ({
        // State
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
        selection: initialSelection,
        columnVisibility: defaultColumnVisibility,
        isFiltersPanelOpen: false,
        isFacetsSidebarOpen: true,

        // Filter actions
        setSearch: search =>
          set(state => {
            state.filters.search = search;
            state.pagination.page = 1; // Reset to first page
          }),

        setStatus: status =>
          set(state => {
            state.filters.status = status;
            state.pagination.page = 1;
          }),

        setPriority: priority =>
          set(state => {
            state.filters.priority = priority;
            state.pagination.page = 1;
          }),

        setType: type =>
          set(state => {
            state.filters.type = type;
            state.pagination.page = 1;
          }),

        setSeverity: severity =>
          set(state => {
            state.filters.severity = severity;
            state.pagination.page = 1;
          }),

        setAssignee: assigneeId =>
          set(state => {
            state.filters.assigneeId = assigneeId;
            state.pagination.page = 1;
          }),

        setDateRange: (from, to) =>
          set(state => {
            state.filters.dateRange = { from, to };
            state.pagination.page = 1;
          }),

        resetFilters: () =>
          set(state => {
            state.filters = initialFilters;
            state.pagination.page = 1;
          }),

        // Sort actions
        setSort: (sortBy, sortOrder) =>
          set(state => {
            if (state.sort.sortBy === sortBy && !sortOrder) {
              state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
              state.sort.sortBy = sortBy;
              state.sort.sortOrder = sortOrder || 'desc';
            }
          }),

        toggleSortOrder: () =>
          set(state => {
            state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
          }),

        // Pagination actions
        setPage: page =>
          set(state => {
            state.pagination.page = page;
          }),

        setPageSize: pageSize =>
          set(state => {
            state.pagination.pageSize = pageSize;
            state.pagination.page = 1;
          }),

        nextPage: () =>
          set(state => {
            state.pagination.page += 1;
          }),

        prevPage: () =>
          set(state => {
            if (state.pagination.page > 1) {
              state.pagination.page -= 1;
            }
          }),

        // Selection actions
        selectRow: id =>
          set(state => {
            state.selection.selectedIds.add(id);
          }),

        deselectRow: id =>
          set(state => {
            state.selection.selectedIds.delete(id);
            state.selection.isAllSelected = false;
          }),

        toggleRow: id =>
          set(state => {
            if (state.selection.selectedIds.has(id)) {
              state.selection.selectedIds.delete(id);
              state.selection.isAllSelected = false;
            } else {
              state.selection.selectedIds.add(id);
            }
          }),

        selectAll: ids =>
          set(state => {
            ids.forEach(id => state.selection.selectedIds.add(id));
            state.selection.isAllSelected = true;
          }),

        deselectAll: () =>
          set(state => {
            state.selection.selectedIds.clear();
            state.selection.isAllSelected = false;
          }),

        toggleAll: ids =>
          set(state => {
            if (state.selection.isAllSelected) {
              state.selection.selectedIds.clear();
              state.selection.isAllSelected = false;
            } else {
              ids.forEach(id => state.selection.selectedIds.add(id));
              state.selection.isAllSelected = true;
            }
          }),

        // Column visibility
        setColumnVisibility: (columnId, visible) =>
          set(state => {
            state.columnVisibility[columnId] = visible;
          }),

        toggleColumn: columnId =>
          set(state => {
            state.columnVisibility[columnId] = !state.columnVisibility[columnId];
          }),

        // Panel actions
        toggleFiltersPanel: () =>
          set(state => {
            state.isFiltersPanelOpen = !state.isFiltersPanelOpen;
          }),

        toggleFacetsSidebar: () =>
          set(state => {
            state.isFacetsSidebarOpen = !state.isFacetsSidebarOpen;
          }),

        setFiltersPanelOpen: open =>
          set(state => {
            state.isFiltersPanelOpen = open;
          }),

        setFacetsSidebarOpen: open =>
          set(state => {
            state.isFacetsSidebarOpen = open;
          }),
      })),
      {
        name: 'ticket-table-storage',
        partialize: state => ({
          sort: state.sort,
          pagination: { pageSize: state.pagination.pageSize },
          columnVisibility: state.columnVisibility,
          isFacetsSidebarOpen: state.isFacetsSidebarOpen,
        }),
      }
    ),
    { name: 'TicketTableStore' }
  )
);

// Selector hooks for optimized re-renders
export const useTicketFilters = () => useTicketTableStore(s => s.filters);
export const useTicketSort = () => useTicketTableStore(s => s.sort);
export const useTicketPagination = () => useTicketTableStore(s => s.pagination);
export const useTicketSelection = () => useTicketTableStore(s => s.selection);
export const useSelectedIds = () => useTicketTableStore(s => Array.from(s.selection.selectedIds));
export const useSelectedCount = () => useTicketTableStore(s => s.selection.selectedIds.size);
