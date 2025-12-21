import { useState, useEffect, useCallback } from 'react';
import { X, Settings, Send, Code, Clock, Keyboard } from 'lucide-react';
import { useStore } from '../../../stores';
import type { AppSettings } from '../../../stores/slices/settingsSlice';
import { DEFAULT_SETTINGS } from '../../../stores/slices/settingsSlice';
import styles from './SettingsModal.module.css';

type SettingsSection = 'general' | 'request' | 'editor' | 'history' | 'shortcuts';

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'request', label: 'Request', icon: Send },
  { id: 'editor', label: 'Editor', icon: Code },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? 'Cmd' : 'Ctrl';

const SHORTCUTS = [
  { action: 'Send request', keys: `${modKey}+Enter` },
  { action: 'New tab', keys: `${modKey}+N` },
  { action: 'Close tab', keys: `${modKey}+W` },
  { action: 'Save request', keys: `${modKey}+S` },
  { action: 'Toggle sidebar', keys: `${modKey}+B` },
  { action: 'Focus URL bar', keys: `${modKey}+L` },
  { action: 'Global search', keys: `${modKey}+K` },
  { action: 'Settings', keys: `${modKey}+,` },
  { action: 'New collection', keys: `${modKey}+Shift+N` },
  { action: 'Switch to tab 1-9', keys: `${modKey}+1-9` },
];

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function SettingsModal() {
  const showSettings = useStore((s) => s.showSettings);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const loadSettings = useStore((s) => s.loadSettings);
  const saveSettings = useStore((s) => s.saveSettings);

  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [draft, setDraft] = useState<AppSettings>(() => deepClone(DEFAULT_SETTINGS));
  const [dirty, setDirty] = useState(false);

  // Load settings and sync draft when modal opens
  useEffect(() => {
    if (showSettings) {
      loadSettings().then(() => {
        setDraft(deepClone(useStore.getState().settings));
        setDirty(false);
        setActiveSection('general');
      });
    }
  }, [showSettings, loadSettings]);

  // Escape key to close
  useEffect(() => {
    if (!showSettings) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showSettings, setShowSettings]);

  const updateDraft = useCallback(
    <K extends keyof AppSettings>(
      section: K,
      key: string,
      value: unknown
    ) => {
      setDraft((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      }));
      setDirty(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    await saveSettings(draft);
    setDirty(false);
    setShowSettings(false);
  }, [draft, saveSettings, setShowSettings]);

  const handleCancel = useCallback(() => {
    setShowSettings(false);
  }, [setShowSettings]);

  if (!showSettings) return null;

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeButton} onClick={handleCancel} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Sidebar tabs */}
          <div className={styles.sidebar}>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  className={`${styles.sidebarItem} ${
                    activeSection === s.id ? styles.sidebarItemActive : ''
                  }`}
                  onClick={() => setActiveSection(s.id)}
                >
                  <Icon size={14} />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className={styles.content}>
            {activeSection === 'general' && (
              <GeneralSection draft={draft} updateDraft={updateDraft} />
            )}
            {activeSection === 'request' && (
              <RequestSection draft={draft} updateDraft={updateDraft} />
            )}
            {activeSection === 'editor' && (
              <EditorSection draft={draft} updateDraft={updateDraft} />
            )}
            {activeSection === 'history' && (
              <HistorySection draft={draft} updateDraft={updateDraft} />
            )}
            {activeSection === 'shortcuts' && <ShortcutsSection />}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            {dirty ? 'Unsaved changes' : ''}
          </span>
          <button className={styles.cancelButton} onClick={handleCancel}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave} disabled={!dirty}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----- Section components ----- */

interface SectionProps {
  draft: AppSettings;
  updateDraft: <K extends keyof AppSettings>(section: K, key: string, value: unknown) => void;
}

function GeneralSection({ draft, updateDraft }: SectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>General</h3>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Default HTTP method</label>
          <select
            className={styles.selectInput}
            value={draft.general.defaultMethod}
            onChange={(e) => updateDraft('general', 'defaultMethod', e.target.value)}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <span className={styles.fieldHint}>Method used for new request tabs</span>
      </div>
    </div>
  );
}

function RequestSection({ draft, updateDraft }: SectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Request Defaults</h3>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Timeout (seconds)</label>
          <input
            type="number"
            className={`${styles.fieldInput} ${styles.numberInput}`}
            value={draft.request.timeout}
            min={1}
            max={300}
            onChange={(e) =>
              updateDraft('request', 'timeout', Math.max(1, parseInt(e.target.value) || 1))
            }
          />
        </div>
        <span className={styles.fieldHint}>Max time to wait for a response</span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Follow redirects</label>
          <Toggle
            checked={draft.request.followRedirects}
            onChange={(v) => updateDraft('request', 'followRedirects', v)}
          />
        </div>
        <span className={styles.fieldHint}>Automatically follow HTTP redirects</span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Verify SSL certificates</label>
          <Toggle
            checked={draft.request.verifySsl}
            onChange={(v) => updateDraft('request', 'verifySsl', v)}
          />
        </div>
        <span className={styles.fieldHint}>Reject connections with invalid SSL certificates</span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Custom User-Agent</label>
          <input
            type="text"
            className={`${styles.fieldInput} ${styles.textInput}`}
            value={draft.request.userAgent}
            placeholder="Default"
            onChange={(e) => updateDraft('request', 'userAgent', e.target.value)}
          />
        </div>
        <span className={styles.fieldHint}>Leave empty to use the default User-Agent</span>
      </div>
    </div>
  );
}

function EditorSection({ draft, updateDraft }: SectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Editor</h3>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Font size</label>
          <input
            type="number"
            className={`${styles.fieldInput} ${styles.numberInput}`}
            value={draft.editor.fontSize}
            min={10}
            max={24}
            onChange={(e) =>
              updateDraft('editor', 'fontSize', Math.max(10, parseInt(e.target.value) || 13))
            }
          />
        </div>
        <span className={styles.fieldHint}>Font size for the code editor (px)</span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Tab size</label>
          <input
            type="number"
            className={`${styles.fieldInput} ${styles.numberInput}`}
            value={draft.editor.tabSize}
            min={1}
            max={8}
            onChange={(e) =>
              updateDraft('editor', 'tabSize', Math.max(1, parseInt(e.target.value) || 2))
            }
          />
        </div>
        <span className={styles.fieldHint}>Number of spaces per indentation level</span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Word wrap</label>
          <Toggle
            checked={draft.editor.wordWrap}
            onChange={(v) => updateDraft('editor', 'wordWrap', v)}
          />
        </div>
        <span className={styles.fieldHint}>Wrap long lines in the editor</span>
      </div>
    </div>
  );
}

function HistorySection({ draft, updateDraft }: SectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>History</h3>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Enable history</label>
          <Toggle
            checked={draft.history.enabled}
            onChange={(v) => updateDraft('history', 'enabled', v)}
          />
        </div>
        <span className={styles.fieldHint}>Record request history automatically</span>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Retention (days)</label>
          <input
            type="number"
            className={`${styles.fieldInput} ${styles.numberInput}`}
            value={draft.history.retentionDays}
            min={1}
            max={365}
            onChange={(e) =>
              updateDraft('history', 'retentionDays', Math.max(1, parseInt(e.target.value) || 30))
            }
          />
        </div>
        <span className={styles.fieldHint}>Number of days to keep history entries</span>
      </div>
    </div>
  );
}

function ShortcutsSection() {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Keyboard Shortcuts</h3>
      <table className={styles.shortcutsTable}>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.action}>
              <td>{s.action}</td>
              <td>
                {s.keys.split('+').map((k, i) => (
                  <span key={i}>
                    {i > 0 && ' + '}
                    <span className={styles.kbd}>{k}</span>
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----- Toggle component ----- */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        className={styles.toggleInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.toggleTrack} />
    </label>
  );
}
