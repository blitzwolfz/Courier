import type { StateCreator } from 'zustand';
import type { ResponseData } from '../../types/response';
import type { AppState } from '../index';

export interface ResponseSlice {
  response: ResponseData | null;
  responseError: string | null;
  isRequesting: boolean;
  requestId: string | null;
  isCancelled: boolean;

  setResponse: (response: ResponseData) => void;
  setResponseError: (error: string) => void;
  clearResponse: () => void;
  setIsRequesting: (isRequesting: boolean) => void;
  setRequestId: (id: string | null) => void;
  cancelRequest: () => void;
}

export const createResponseSlice: StateCreator<AppState, [], [], ResponseSlice> = (set) => ({
  response: null,
  responseError: null,
  isRequesting: false,
  requestId: null,
  isCancelled: false,

  setResponse: (response) => set({ response, responseError: null }),
  setResponseError: (error) => set({ responseError: error, response: null }),
  clearResponse: () => set({ response: null, responseError: null }),
  setIsRequesting: (isRequesting) => set({ isRequesting }),
  setRequestId: (id) => set({ requestId: id }),
  cancelRequest: () => set({ isCancelled: true, isRequesting: false, responseError: 'Request cancelled', response: null }),
});
