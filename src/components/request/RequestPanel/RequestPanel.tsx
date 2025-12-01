import { useState } from 'react';
import { X, Plus, Send } from 'lucide-react';
import { useStore } from '../../../stores';
import { UrlBar } from '../UrlBar/UrlBar';
import { ParamsEditor } from '../ParamsEditor/ParamsEditor';
import { HeadersEditor } from '../HeadersEditor/HeadersEditor';
import { BodyEditor } from '../BodyEditor/BodyEditor';
import { AuthEditor } from '../AuthEditor/AuthEditor';
import { ScriptEditor } from '../ScriptEditor/ScriptEditor';
import { Tabs } from '../../common/Tabs/Tabs';
import { MethodBadge } from '../../common/Badge/Badge';
import { Button } from '../../common/Button/Button';
import type { HttpMethod } from '../../../types/request';
import styles from './RequestPanel.module.css';

const CONFIG_TABS = [
  { id: 'params', label: 'Params' },
  { id: 'auth', label: 'Auth' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'pre-request', label: 'Pre-Request' },
  { id: 'tests', label: 'Tests' },
];

export function RequestPanel() {
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const activeRequest = useStore((s) => s.activeRequest);
  const switchTab = useStore((s) => s.switchTab);
  const closeTab = useStore((s) => s.closeTab);
  const newTab = useStore((s) => s.newTab);

  const [configTab, setConfigTab] = useState('params');

  if (openTabs.length === 0 || !activeRequest) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Send size={48} strokeWidth={1} className={styles.emptyIcon} />
          <p>Create a new request to get started.</p>
          <Button variant="primary" onClick={newTab}>
            New Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabScroll}>
          {openTabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTabId === tab.id ? styles.tabActive : ''}`}
              onClick={() => switchTab(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              title={tab.url || tab.name || 'Untitled'}
            >
              <MethodBadge method={tab.method as HttpMethod} />
              <span className={styles.tabName}>{tab.name || 'Untitled'}</span>
              <span
                className={styles.tabClose}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
        <button className={styles.newTabBtn} onClick={newTab} title="New Request">
          <Plus size={14} />
        </button>
      </div>

      {/* URL Bar */}
      <UrlBar />

      {/* Config Tabs */}
      <Tabs tabs={CONFIG_TABS} activeTab={configTab} onTabChange={setConfigTab} />

      {/* Config Area */}
      <div className={styles.configArea}>
        {configTab === 'params' && <ParamsEditor />}
        {configTab === 'auth' && <AuthEditor />}
        {configTab === 'headers' && <HeadersEditor />}
        {configTab === 'body' && <BodyEditor />}
        {configTab === 'pre-request' && <ScriptEditor type="pre-request" />}
        {configTab === 'tests' && <ScriptEditor type="tests" />}
      </div>
    </div>
  );
}
