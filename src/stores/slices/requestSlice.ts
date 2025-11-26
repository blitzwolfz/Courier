import type { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { RequestData } from '../../types/request';
import { createEmptyRequest } from '../../types/request';
import type { AppState } from '../index';

export interface RequestSlice {
  activeRequest: RequestData | null;
  openTabs: RequestData[];
  activeTabId: string | null;

  setActiveRequest: (request: RequestData | null) => void;
  updateActiveRequest: (partial: Partial<RequestData>) => void;
  openTab: (request: RequestData) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  newTab: () => void;
}

export const createRequestSlice: StateCreator<AppState, [], [], RequestSlice> = (set) => ({
  activeRequest: null,
  openTabs: [],
  activeTabId: null,

  setActiveRequest: (request) => set({ activeRequest: request }),

  updateActiveRequest: (partial) =>
    set((state) => {
      if (!state.activeRequest) return {};
      const updated = { ...state.activeRequest, ...partial, updatedAt: new Date().toISOString() };
      const openTabs = state.openTabs.map((t) => (t.id === updated.id ? updated : t));
      return { activeRequest: updated, openTabs };
    }),

  openTab: (request) =>
    set((state) => {
      const existing = state.openTabs.find((t) => t.id === request.id);
      if (existing) {
        return { activeRequest: existing, activeTabId: existing.id };
      }
      return {
        openTabs: [...state.openTabs, request],
        activeRequest: request,
        activeTabId: request.id,
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const filtered = state.openTabs.filter((t) => t.id !== id);
      if (state.activeTabId === id) {
        const lastTab = filtered[filtered.length - 1] ?? null;
        return {
          openTabs: filtered,
          activeTabId: lastTab?.id ?? null,
          activeRequest: lastTab,
        };
      }
      return { openTabs: filtered };
    }),

  switchTab: (id) =>
    set((state) => {
      const tab = state.openTabs.find((t) => t.id === id);
      if (tab) {
        return { activeTabId: id, activeRequest: tab };
      }
      return {};
    }),

  newTab: () => {
    const request = createEmptyRequest(uuidv4());
    set((state) => ({
      openTabs: [...state.openTabs, request],
      activeRequest: request,
      activeTabId: request.id,
    }));
  },
});
