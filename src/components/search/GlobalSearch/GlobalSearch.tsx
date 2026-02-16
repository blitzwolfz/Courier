import { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, FileText, Clock } from 'lucide-react';
import { useStore } from '../../../stores';
import { MethodBadge } from '../../common/Badge/Badge';
import { globalSearch, getRequest, type SearchResult } from '../../../utils/api';
import { createEmptyRequest, type HttpMethod, type RequestData } from '../../../types/request';
import { v4 as uuidv4 } from 'uuid';
import styles from './GlobalSearch.module.css';

export function GlobalSearch() {
  const showSearch = useStore((s) => s.showSearch);
  const setShowSearch = useStore((s) => s.setShowSearch);
  const openTab = useStore((s) => s.openTab);
  const setActivePanel = useStore((s) => s.setActivePanel);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when shown
  useEffect(() => {
    if (showSearch) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showSearch]);

  // Search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await globalSearch(query);
        setResults(res);
        setActiveIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback(
    async (result: SearchResult) => {
      setShowSearch(false);

      if (result.result_type === 'collection') {
        setActivePanel('collections');
        if (!sidebarVisible) toggleSidebar();
      } else if (result.result_type === 'request') {
        try {
          const fullRequest = await getRequest(result.id);
          openTab(fullRequest as RequestData);
        } catch {
          // Fallback if fetch fails
          openTab({
            id: result.id,
            collectionId: result.collection_id ?? null,
            name: result.name,
            method: (result.method || 'GET') as HttpMethod,
            url: result.url || '',
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
        }
      } else if (result.result_type === 'history') {
        // Open history entry as a new tab
        const req = createEmptyRequest(uuidv4());
        req.method = (result.method || 'GET') as HttpMethod;
        req.url = result.url || '';
        req.name = result.name;
        openTab(req);
      }
    },
    [setShowSearch, openTab, setActivePanel, sidebarVisible, toggleSidebar]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      } else if (e.key === 'Escape') {
        setShowSearch(false);
      }
    },
    [results, activeIndex, handleSelect, setShowSearch]
  );

  if (!showSearch) return null;

  // Group results by type
  const collections = results.filter((r) => r.result_type === 'collection');
  const requests = results.filter((r) => r.result_type === 'request');
  const history = results.filter((r) => r.result_type === 'history');

  let globalIdx = 0;

  return (
    <div className={styles.overlay} onClick={() => setShowSearch(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search collections, requests, history..."
        />

        <div className={styles.results}>
          {query.trim() && results.length === 0 && (
            <div className={styles.noResults}>No results found</div>
          )}

          {collections.length > 0 && (
            <div className={styles.resultGroup}>
              <div className={styles.groupLabel}>Collections</div>
              {collections.map((r) => {
                const idx = globalIdx++;
                return (
                  <div
                    key={r.id}
                    className={`${styles.resultItem} ${
                      idx === activeIndex ? styles.resultItemActive : ''
                    }`}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className={styles.resultIcon}>
                      <Folder size={14} />
                    </span>
                    <span className={styles.resultName}>{r.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {requests.length > 0 && (
            <div className={styles.resultGroup}>
              <div className={styles.groupLabel}>Requests</div>
              {requests.map((r) => {
                const idx = globalIdx++;
                return (
                  <div
                    key={r.id}
                    className={`${styles.resultItem} ${
                      idx === activeIndex ? styles.resultItemActive : ''
                    }`}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className={styles.resultIcon}>
                      {r.method ? (
                        <MethodBadge method={r.method as HttpMethod} />
                      ) : (
                        <FileText size={14} />
                      )}
                    </span>
                    <span className={styles.resultName}>{r.name}</span>
                    {r.collection_name && (
                      <span className={styles.resultMeta}>{r.collection_name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {history.length > 0 && (
            <div className={styles.resultGroup}>
              <div className={styles.groupLabel}>History</div>
              {history.map((r) => {
                const idx = globalIdx++;
                return (
                  <div
                    key={r.id}
                    className={`${styles.resultItem} ${
                      idx === activeIndex ? styles.resultItemActive : ''
                    }`}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className={styles.resultIcon}>
                      <Clock size={14} />
                    </span>
                    <span className={styles.resultName}>{r.name}</span>
                    {r.url && <span className={styles.resultMeta}>{r.url}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerKey}>
            <span className={styles.kbd}>↑↓</span> navigate
          </span>
          <span className={styles.footerKey}>
            <span className={styles.kbd}>↵</span> open
          </span>
          <span className={styles.footerKey}>
            <span className={styles.kbd}>esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}
