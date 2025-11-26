import type { StateCreator } from 'zustand';
import type { Environment } from '../../types/environment';
import type { AppState } from '../index';
import * as api from '../../utils/api';

export interface EnvironmentSlice {
  environments: Environment[];
  activeEnvironmentId: string | null;

  loadEnvironments: () => Promise<void>;
  addEnvironment: (name: string) => Promise<void>;
  removeEnvironment: (id: string) => Promise<void>;
  updateEnvironmentData: (id: string, name: string, variables: unknown) => Promise<void>;
  setActiveEnvironmentId: (id: string | null) => Promise<void>;
}

export const createEnvironmentSlice: StateCreator<AppState, [], [], EnvironmentSlice> = (set, get) => ({
  environments: [],
  activeEnvironmentId: null,

  loadEnvironments: async () => {
    const environments = await api.getEnvironments();
    const active = environments.find((e) => e.isActive);
    set({ environments, activeEnvironmentId: active?.id ?? null });
  },

  addEnvironment: async (name) => {
    await api.createEnvironment(name, []);
    await get().loadEnvironments();
  },

  removeEnvironment: async (id) => {
    await api.deleteEnvironment(id);
    await get().loadEnvironments();
  },

  updateEnvironmentData: async (id, name, variables) => {
    await api.updateEnvironment(id, name, variables);
    await get().loadEnvironments();
  },

  setActiveEnvironmentId: async (id) => {
    if (id) {
      await api.setActiveEnvironment(id);
    }
    set({ activeEnvironmentId: id });
  },
});
