import { useState, useEffect, useCallback } from 'react';
import { X, Play, Square } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { Button } from '../../common/Button/Button';
import { Input } from '../../common/Input/Input';
import { IconButton } from '../../common/IconButton/IconButton';
import { MethodBadge, StatusBadge } from '../../common/Badge/Badge';
import { runCollection, cancelRunner } from '../../../utils/api';
import type { HttpMethod } from '../../../types/request';
import styles from './CollectionRunner.module.css';

interface RunnerProgress {
  runner_id: string;
  index: number;
  total: number;
  iteration: number;
  total_iterations: number;
  request_name: string;
  method: string;
  url: string;
  status_code: number | null;
  response_time: number | null;
  test_results: { name: string; passed: boolean; error: string | null }[];
  error: string | null;
}

interface CollectionRunnerProps {
  collectionId: string;
  collectionName: string;
  onClose: () => void;
}

export function CollectionRunner({ collectionId, collectionName, onClose }: CollectionRunnerProps) {
  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const [running, setRunning] = useState(false);
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [results, setResults] = useState<RunnerProgress[]>([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!runnerId) return;

    const unlistenProgress = listen<RunnerProgress>(`runner-progress-${runnerId}`, (event) => {
      setResults((prev) => [...prev, event.payload]);
    });

    const unlistenComplete = listen(`runner-complete-${runnerId}`, () => {
      setRunning(false);
      setCompleted(true);
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [runnerId]);

  const handleRun = useCallback(async () => {
    setResults([]);
    setRunning(true);
    setCompleted(false);
    try {
      const result = await runCollection(collectionId, {
        iterations,
        delayMs: delay,
      }) as { runner_id: string };
      setRunnerId(result.runner_id);
    } catch (err) {
      setRunning(false);
      console.error('Runner failed:', err);
    }
  }, [collectionId, iterations, delay]);

  const handleCancel = useCallback(async () => {
    await cancelRunner();
    setRunning(false);
  }, []);

  const totalTests = results.reduce((sum, r) => sum + r.test_results.length, 0);
  const passedTests = results.reduce(
    (sum, r) => sum + r.test_results.filter((t) => t.passed).length,
    0
  );
  const failedRequests = results.filter((r) => r.error !== null).length;
  const totalTime = results.reduce((sum, r) => sum + (r.response_time ?? 0), 0);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Run: {collectionName}</h3>
          <IconButton onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        {!running && !completed && (
          <div className={styles.settings}>
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>Iterations</label>
              <Input
                type="number"
                value={String(iterations)}
                onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 80 }}
              />
            </div>
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>Delay (ms)</label>
              <Input
                type="number"
                value={String(delay)}
                onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: 80 }}
              />
            </div>
            <Button variant="primary" onClick={handleRun}>
              <Play size={14} /> Run Collection
            </Button>
          </div>
        )}

        {running && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: results.length > 0
                  ? `${(results.length / (results[0]?.total * (results[0]?.total_iterations ?? 1))) * 100}%`
                  : '0%',
              }}
            />
          </div>
        )}

        {(running || completed) && (
          <>
            <div className={styles.summary}>
              <span className={styles.summaryItem}>
                <strong>{results.length}</strong> requests
              </span>
              <span className={styles.summaryItem}>
                <strong>{passedTests}</strong>/{totalTests} tests passed
              </span>
              <span className={styles.summaryItem}>
                <strong>{failedRequests}</strong> errors
              </span>
              <span className={styles.summaryItem}>
                <strong>{totalTime}</strong>ms total
              </span>
              {running && (
                <Button variant="secondary" onClick={handleCancel}>
                  <Square size={12} /> Stop
                </Button>
              )}
            </div>

            <div className={styles.results}>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`${styles.resultRow} ${r.error ? styles.resultError : styles.resultOk}`}
                >
                  <MethodBadge method={(r.method || 'GET') as HttpMethod} />
                  <span className={styles.resultName}>{r.request_name}</span>
                  {r.status_code != null && <StatusBadge code={r.status_code} />}
                  {r.response_time != null && (
                    <span className={styles.resultTime}>{r.response_time}ms</span>
                  )}
                  {r.test_results.length > 0 && (
                    <span className={styles.resultTests}>
                      {r.test_results.filter((t) => t.passed).length}/{r.test_results.length}
                    </span>
                  )}
                  {r.error && <span className={styles.resultErrorMsg}>{r.error}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
