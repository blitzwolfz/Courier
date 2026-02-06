import { Moon, Sun, PanelLeftClose, PanelLeft, Settings } from 'lucide-react';
import { useStore } from '../../../stores';
import { IconButton } from '../../common/IconButton/IconButton';
import type { SidebarPanel, WorkspaceMode } from '../../../stores/slices/uiSlice';
import styles from './TopBar.module.css';

const NAV_ITEMS: { id: SidebarPanel; label: string }[] = [
  { id: 'collections', label: 'Collections' },
  { id: 'history', label: 'History' },
  { id: 'environments', label: 'Environments' },
];

const MODE_ITEMS: { id: WorkspaceMode; label: string }[] = [
  { id: 'http', label: 'HTTP' },
  { id: 'websocket', label: 'WS' },
  { id: 'grpc', label: 'gRPC' },
];

export function TopBar() {
  const activePanel = useStore((s) => s.activePanel);
  const setActivePanel = useStore((s) => s.setActivePanel);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const setActiveEnvironmentId = useStore((s) => s.setActiveEnvironmentId);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const workspaceMode = useStore((s) => s.workspaceMode);
  const setWorkspaceMode = useStore((s) => s.setWorkspaceMode);
  const setShowSettings = useStore((s) => s.setShowSettings);

  const handleNavClick = (panel: SidebarPanel) => {
    if (activePanel === panel && sidebarVisible) {
      toggleSidebar();
    } else {
      setActivePanel(panel);
      if (!sidebarVisible) toggleSidebar();
    }
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <svg className={styles.logoIcon} viewBox="0 0 512 512" fill="none">
            <rect width="512" height="512" fill="none"/>
            <rect x="56" y="116" width="400" height="284" fill="#F5F0EB"/>
            <polygon points="56,116 256,272 456,116" fill="#FFFFFF"/>
            <polygon points="256,200 324,264 256,328 188,264" fill="#000000"/>
            <polygon points="240,248 280,264 240,280" fill="#F5F0EB"/>
            <rect x="366" y="400" width="146" height="112" fill="#FFD700"/>
          </svg>
          COURIER
        </div>
        <IconButton
          onClick={toggleSidebar}
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {sidebarVisible ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </IconButton>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navButton} ${
              activePanel === item.id && sidebarVisible ? styles.navButtonActive : ''
            }`}
            onClick={() => handleNavClick(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className={styles.navDivider} />
        {MODE_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navButton} ${
              workspaceMode === item.id ? styles.navButtonActive : ''
            }`}
            onClick={() => setWorkspaceMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.actions}>
        {environments.length > 0 && (
          <select
            className={styles.envSelect}
            value={activeEnvironmentId ?? ''}
            onChange={(e) => setActiveEnvironmentId(e.target.value || null)}
          >
            <option value="">No Environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        )}
        <IconButton
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <IconButton
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <Settings size={16} />
        </IconButton>
      </div>
    </div>
  );
}
