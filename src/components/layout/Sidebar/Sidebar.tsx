import { useEffect, useRef } from 'react';
import { Search, Trash2, Clock } from 'lucide-react';
import { useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../../stores';
import { CollectionsTree } from '../../collections/CollectionsTree/CollectionsTree';
import { EnvironmentsList } from '../../environments/EnvironmentsList/EnvironmentsList';
import { MethodBadge, StatusBadge } from '../../common/Badge/Badge';
import { IconButton } from '../../common/IconButton/IconButton';
import type { HttpMethod } from '../../../types/request';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const activePanel = useStore((s) => s.activePanel);

  return (
    <div className={styles.sidebar}>
      {activePanel === 'collections' && <CollectionsTree />}
      {activePanel === 'history' && <HistoryPanel />}
      {activePanel === 'environments' && <EnvironmentsList />}
    </div>
  );
}

function HistoryPanel() {
  const historyEntries = useStore((s) => s.historyEntries);
  const loadHistory = useStore((s) => s.loadHistory);
  const clearAllHistory = useStore((s) => s.clearAllHistory);
  const openTab = useStore((s) => s.openTab);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = historyEntries.filter((entry) => {
    if (search && !entry.url.toLowerCase().includes(search.toLowerCase())) return false;
    if (methodFilter && entry.method !== methodFilter) return false;
    return true;
  });

  const handleOpenEntry = (entry: { method: string; url: string; id: string }) => {
    openTab({
      id: `history-${entry.id}`,
      collectionId: null,
      name: entry.url.replace(/^https?:\/\//, '').split('/').slice(0, 2).join('/') || entry.url,
      method: (entry.method || 'GET') as HttpMethod,
      url: entry.url,
      params: [],
      headers: [],
      body: { type: 'none', content: '' },
      auth: { type: 'none' },
      preRequestScript: '',
      testScript: '',
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return ts;
    }
  };

  return (
    <>
      <div className={styles.header}>
        <span className={styles.title}>History</span>
        {historyEntries.length > 0 && (
          <IconButton onClick={clearAllHistory} title="Clear all history">
            <Trash2 size={14} />
          </IconButton>
        )}
      </div>

      {historyEntries.length > 0 && (
        <div className={styles.searchBar}>
          <Search size={12} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by URL..."
          />
          <select
            className={styles.methodFilter}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DEL</option>
          </select>
        </div>
      )}

      <div className={styles.content} ref={scrollRef}>
        {historyEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <Clock size={32} strokeWidth={1} />
            <p>No history yet.</p>
            <p>Send a request to see it here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No matching entries.</p>
          </div>
        ) : (
          <VirtualHistoryList
            items={filtered}
            scrollRef={scrollRef}
            onOpen={handleOpenEntry}
            formatTimestamp={formatTimestamp}
          />
        )}
      </div>
    </>
  );
}

interface VirtualHistoryListProps {
  items: { id: string; method: string; url: string; status_code: number; response_time: number; timestamp: string }[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onOpen: (entry: { method: string; url: string; id: string }) => void;
  formatTimestamp: (ts: string) => string;
}

function VirtualHistoryList({ items, scrollRef, onOpen, formatTimestamp }: VirtualHistoryListProps) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 10,
  });

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((vItem) => {
        const entry = items[vItem.index];
        return (
          <div
            key={entry.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: vItem.size,
              transform: `translateY(${vItem.start}px)`,
            }}
          >
            <div
              className={styles.historyItem}
              onClick={() => onOpen(entry)}
            >
              <div className={styles.historyTop}>
                <MethodBadge method={(entry.method || 'GET') as HttpMethod} />
                {entry.status_code > 0 && (
                  <StatusBadge code={entry.status_code} />
                )}
                <span className={styles.historyTime}>
                  {entry.response_time}ms
                </span>
              </div>
              <div className={styles.historyUrl}>{entry.url}</div>
              <div className={styles.historyTimestamp}>
                {formatTimestamp(entry.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
