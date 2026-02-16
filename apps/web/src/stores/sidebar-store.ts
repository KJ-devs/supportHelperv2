import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    set => ({
      isCollapsed: false,
      isMobileOpen: false,
      toggle: () => set(state => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: collapsed => set({ isCollapsed: collapsed }),
      setMobileOpen: open => set({ isMobileOpen: open }),
      toggleMobile: () => set(state => ({ isMobileOpen: !state.isMobileOpen })),
    }),
    {
      name: 'sidebar-storage',
    }
  )
);
