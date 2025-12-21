import { useEffect } from 'react';
import { useStore } from '../stores';

/**
 * Global keyboard shortcuts for the Courier app.
 * Platform-aware: uses Ctrl on Windows/Linux, Cmd on Mac.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const state = useStore.getState();

      // Ctrl+Enter — Send request (handled by UrlBar, but we fire a custom event)
      if (e.key === 'Enter') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('courier:send-request'));
        return;
      }

      // Ctrl+N — New tab
      if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        state.newTab();
        return;
      }

      // Ctrl+W — Close active tab
      if (e.key === 'w') {
        e.preventDefault();
        if (state.activeTabId) {
          state.closeTab(state.activeTabId);
        }
        return;
      }

      // Ctrl+S — Save request (fires custom event for components to handle)
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('courier:save-request'));
        return;
      }

      // Ctrl+B — Toggle sidebar
      if (e.key === 'b') {
        e.preventDefault();
        state.toggleSidebar();
        return;
      }

      // Ctrl+L — Focus URL bar
      if (e.key === 'l') {
        e.preventDefault();
        const urlInput = document.querySelector<HTMLInputElement>('[data-url-bar]');
        if (urlInput) urlInput.focus();
        return;
      }

      // Ctrl+K — Open global search
      if (e.key === 'k') {
        e.preventDefault();
        state.setShowSearch(!state.showSearch);
        return;
      }

      // Ctrl+, — Open settings
      if (e.key === ',') {
        e.preventDefault();
        state.setShowSettings(!state.showSettings);
        return;
      }

      // Ctrl+Shift+N — New collection
      if (e.key === 'N' && e.shiftKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('courier:new-collection'));
        return;
      }

      // Ctrl+1-9 — Switch to tab N
      const tabNum = parseInt(e.key);
      if (tabNum >= 1 && tabNum <= 9) {
        e.preventDefault();
        const tabs = state.openTabs;
        const idx = tabNum - 1;
        if (idx < tabs.length) {
          state.switchTab(tabs[idx].id);
        }
        return;
      }
    };

    // Escape handler (no modifier needed)
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useStore.getState();
        if (state.showSettings) {
          state.setShowSettings(false);
        } else if (state.showSearch) {
          state.setShowSearch(false);
        }
      }
    };

    document.addEventListener('keydown', handler);
    document.addEventListener('keydown', escHandler);

    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, []);
}
