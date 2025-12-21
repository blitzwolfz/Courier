import type { StateCreator } from 'zustand';
import type { AppState } from '../index';
import * as api from '../../utils/api';

export interface AppSettings {
  general: {
    defaultMethod: string;
  };
  request: {
    timeout: number;
    followRedirects: boolean;
    verifySsl: boolean;
    userAgent: string;
  };
  editor: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
  };
  history: {
    enabled: boolean;
    retentionDays: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    defaultMethod: 'GET',
  },
  request: {
    timeout: 30,
    followRedirects: true,
    verifySsl: true,
    userAgent: '',
  },
  editor: {
    fontSize: 13,
    tabSize: 2,
    wordWrap: true,
  },
  history: {
    enabled: true,
    retentionDays: 30,
  },
};

export interface SettingsSlice {
  settings: AppSettings;
  showSettings: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setShowSettings: (show: boolean) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  showSettings: false,

  loadSettings: async () => {
    try {
      const json = await api.getSettings();
      const parsed = JSON.parse(json);
      // Deep merge with defaults so new fields are always present
      set({
        settings: {
          general: { ...DEFAULT_SETTINGS.general, ...parsed.general },
          request: { ...DEFAULT_SETTINGS.request, ...parsed.request },
          editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
          history: { ...DEFAULT_SETTINGS.history, ...parsed.history },
        },
      });
    } catch {
      // Use defaults on error
    }
  },

  saveSettings: async (settings) => {
    try {
      await api.updateSettings(JSON.stringify(settings));
      set({ settings });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  },

  setShowSettings: (show) => set({ showSettings: show }),
});
