import type { StateCreator } from 'zustand';
import type { Collection } from '../../types/collection';
import type { RequestData } from '../../types/request';
import type { AppState } from '../index';
import * as api from '../../utils/api';

export interface CollectionsSlice {
  collections: Collection[];
  collectionRequests: Record<string, RequestData[]>;

  loadCollections: () => Promise<void>;
  addCollection: (name: string) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  loadCollectionRequests: (collectionId: string) => Promise<void>;
  saveRequest: (request: RequestData) => Promise<void>;
  removeRequest: (id: string, collectionId: string) => Promise<void>;
  importPostmanCollection: (jsonContent: string) => Promise<void>;
  exportPostmanCollection: (collectionId: string) => Promise<string>;
}

export const createCollectionsSlice: StateCreator<AppState, [], [], CollectionsSlice> = (set, get) => ({
  collections: [],
  collectionRequests: {},

  loadCollections: async () => {
    const collections = await api.getCollections();
    set({ collections });
  },

  addCollection: async (name) => {
    await api.createCollection(name);
    await get().loadCollections();
  },

  removeCollection: async (id) => {
    await api.deleteCollection(id);
    await get().loadCollections();
  },

  renameCollection: async (id, name) => {
    const coll = get().collections.find((c) => c.id === id);
    if (coll) {
      await api.updateCollection(id, name, coll.description);
      await get().loadCollections();
    }
  },

  loadCollectionRequests: async (collectionId) => {
    const requests = await api.getRequests(collectionId);
    set((state) => ({
      collectionRequests: {
        ...state.collectionRequests,
        [collectionId]: requests,
      },
    }));
  },

  saveRequest: async (request) => {
    try {
      await api.updateSavedRequest(request);
    } catch {
      await api.createSavedRequest(request);
    }
    if (request.collectionId) {
      await get().loadCollectionRequests(request.collectionId);
    }
  },

  removeRequest: async (id, collectionId) => {
    await api.deleteSavedRequest(id);
    await get().loadCollectionRequests(collectionId);
  },

  importPostmanCollection: async (jsonContent) => {
    await api.importPostmanCollection(jsonContent);
    await get().loadCollections();
  },

  exportPostmanCollection: async (collectionId) => {
    return api.exportPostmanCollection(collectionId);
  },
});
