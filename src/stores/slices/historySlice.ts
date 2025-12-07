import type { StateCreator } from 'zustand';
import type { AppState } from '../index';
import * as api from '../../utils/api';

export interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  status_code: number;
  response_time: number;
  timestamp: string;
}

export interface HistorySlice {
  historyEntries: HistoryEntry[];

  loadHistory: () => Promise<void>;
  clearAllHistory: () => Promise<void>;
}

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set) => ({
  historyEntries: [],

  loadHistory: async () => {
    const entries = (await api.getHistory(100, 0)) as HistoryEntry[];
    set({ historyEntries: entries });
  },

  clearAllHistory: async () => {
    await api.clearHistory();
    set({ historyEntries: [] });
  },
});
