import { create } from 'zustand';
import { createRequestSlice, type RequestSlice } from './slices/requestSlice';
import { createResponseSlice, type ResponseSlice } from './slices/responseSlice';
import { createCollectionsSlice, type CollectionsSlice } from './slices/collectionsSlice';
import { createEnvironmentSlice, type EnvironmentSlice } from './slices/environmentSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createHistorySlice, type HistorySlice } from './slices/historySlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';

export type AppState = RequestSlice &
  ResponseSlice &
  CollectionsSlice &
  EnvironmentSlice &
  UISlice &
  HistorySlice &
  SettingsSlice;

export const useStore = create<AppState>()((...a) => ({
  ...createRequestSlice(...a),
  ...createResponseSlice(...a),
  ...createCollectionsSlice(...a),
  ...createEnvironmentSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),
  ...createSettingsSlice(...a),
}));
