import { useEffect, useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { TopBar } from './components/layout/TopBar/TopBar';
import { Sidebar } from './components/layout/Sidebar/Sidebar';
import { RequestPanel } from './components/request/RequestPanel/RequestPanel';
import { ResponsePanel } from './components/response/ResponsePanel/ResponsePanel';
import { WebSocketPanel } from './components/websocket/WebSocketPanel/WebSocketPanel';
import { GrpcPanel } from './components/grpc/GrpcPanel/GrpcPanel';
import { GlobalSearch } from './components/search/GlobalSearch/GlobalSearch';
import { SettingsModal } from './components/settings/SettingsModal/SettingsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useStore } from './stores';
import styles from './App.module.css';

type SidebarSizing = {
  defaultSize: number;
  minSize: number;
};

type SidebarWidths = {
  defaultWidth: number;
  minWidth: number;
};

const FALLBACK_SIDEBAR_WIDTHS: SidebarWidths = {
  defaultWidth: 320,
  minWidth: 260,
};

function toPercent(px: number, width: number): number {
  return (px / width) * 100;
}

function parseSizeToPx(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  if (normalized.endsWith('vw')) return (window.innerWidth * parsed) / 100;
  return parsed;
}

function getSidebarWidthsFromCss(): SidebarWidths {
  if (typeof window === 'undefined') return FALLBACK_SIDEBAR_WIDTHS;

  const rootStyles = getComputedStyle(document.documentElement);
  const defaultWidth = parseSizeToPx(
    rootStyles.getPropertyValue('--sidebar-width'),
    FALLBACK_SIDEBAR_WIDTHS.defaultWidth
  );
  const minWidth = parseSizeToPx(
    rootStyles.getPropertyValue('--sidebar-min-width'),
    FALLBACK_SIDEBAR_WIDTHS.minWidth
  );

  return {
    defaultWidth,
    minWidth: Math.min(minWidth, defaultWidth),
  };
}

function getSidebarSizing(containerWidth: number, widths: SidebarWidths): SidebarSizing {
  if (containerWidth <= 0) {
    return { defaultSize: 28, minSize: 24 };
  }

  const minSize = Math.min(80, Math.max(15, toPercent(widths.minWidth, containerWidth)));
  const defaultSize = Math.max(minSize, toPercent(widths.defaultWidth, containerWidth));

  return { defaultSize, minSize };
}

function App() {
  useKeyboardShortcuts();

  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const workspaceMode = useStore((s) => s.workspaceMode);
  const [sidebarWidths, setSidebarWidths] = useState<SidebarWidths>(() => getSidebarWidthsFromCss());
  const [sidebarSizing, setSidebarSizing] = useState<SidebarSizing>(() =>
    getSidebarSizing(typeof window === 'undefined' ? 0 : window.innerWidth, getSidebarWidthsFromCss())
  );

  useEffect(() => {
    setSidebarWidths(getSidebarWidthsFromCss());
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;

      setSidebarSizing(getSidebarSizing(entry.contentRect.width, sidebarWidths));
    });

    const appMain = document.querySelector(`.${styles.main}`);
    if (!appMain) return;

    resizeObserver.observe(appMain);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sidebarWidths]);

  return (
    <div className={styles.app}>
      <TopBar />
      <div className={styles.main}>
        <Group orientation="horizontal">
          {sidebarVisible && (
            <>
              <Panel
                id="sidebar"
                defaultSize={sidebarSizing.defaultSize}
                minSize={sidebarSizing.minSize}
              >
                <Sidebar />
              </Panel>
              <Separator className={styles.resizeHandleH} />
            </>
          )}
          <Panel id="workspace" minSize={10}>
            {workspaceMode === 'websocket' ? (
              <WebSocketPanel />
            ) : workspaceMode === 'grpc' ? (
              <GrpcPanel />
            ) : (
              <Group orientation="vertical">
                <Panel id="request" defaultSize={50} minSize={25}>
                  <RequestPanel />
                </Panel>
                <Separator className={styles.resizeHandleV} />
                <Panel id="response" defaultSize={50} minSize={20}>
                  <ResponsePanel />
                </Panel>
              </Group>
            )}
          </Panel>
        </Group>
      </div>
      <GlobalSearch />
      <SettingsModal />
    </div>
  );
}

export default App;
