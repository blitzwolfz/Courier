import type { StateCreator } from 'zustand';
import type { AppState } from '../index';

export type SidebarPanel = 'collections' | 'history' | 'environments';
export type WorkspaceMode = 'http' | 'websocket' | 'grpc';

export interface UISlice {
  sidebarVisible: boolean;
  activePanel: SidebarPanel;
  theme: 'light' | 'dark';
  workspaceMode: WorkspaceMode;
  showSearch: boolean;

  toggleSidebar: () => void;
  setActivePanel: (panel: SidebarPanel) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setShowSearch: (show: boolean) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  sidebarVisible: true,
  activePanel: 'collections',
  theme: 'light',
  workspaceMode: 'http',
  showSearch: false,

  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
  setShowSearch: (show) => set({ showSearch: show }),
});
