import { useState } from 'react';
import { Copy, Check, ArrowDown, RotateCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../stores';
import { Tabs } from '../../common/Tabs/Tabs';
import { StatusBadge } from '../../common/Badge/Badge';
import { IconButton } from '../../common/IconButton/IconButton';
import { Button } from '../../common/Button/Button';
import { CodeEditor } from '../../common/CodeEditor/CodeEditor';
import { CodeGenerator } from '../../codegen/CodeGenerator/CodeGenerator';
import { CookiesViewer } from '../CookiesViewer/CookiesViewer';
import { formatSize } from '../../../types/response';
import styles from './ResponsePanel.module.css';

const RESPONSE_TABS = [
  { id: 'body', label: 'Body' },
  { id: 'headers', label: 'Headers' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'tests', label: 'Tests' },
  { id: 'code', label: 'Code' },
];

const MAX_DISPLAY_SIZE = 5_000_000; // 5MB

function detectLanguage(body: string, headers: Record<string, string>): string {
  const ct = (headers['content-type'] ?? '').toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('javascript')) return 'javascript';
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  return 'plaintext';
}

function formatBody(body: string, language: string): string {
  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

interface ClassifiedError {
  title: string;
  description: string;
  technical: string;
}

function classifyError(error: string): ClassifiedError {
  const lower = error.toLowerCase();

  if (lower.includes('connection refused') || lower.includes('connrefused')) {
    return {
      title: 'Connection Refused',
      description: 'The server is not accepting connections. Check that the server is running and the port is correct.',
      technical: error,
    };
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('timedout')) {
    return {
      title: 'Request Timed Out',
      description: 'The server did not respond within the timeout period. The server may be overloaded or unreachable.',
      technical: error,
    };
  }
  if (lower.includes('dns') || lower.includes('resolve') || lower.includes('getaddrinfo') || lower.includes('name or service not known') || lower.includes('no such host')) {
    return {
      title: 'DNS Resolution Failed',
      description: 'Could not resolve the hostname. Check that the URL is correct and your network connection is active.',
      technical: error,
    };
  }
  if (lower.includes('ssl') || lower.includes('tls') || lower.includes('certificate') || lower.includes('cert')) {
    return {
      title: 'SSL/TLS Error',
      description: 'Could not establish a secure connection. The server certificate may be invalid or expired.',
      technical: error,
    };
  }
  if (lower.includes('network') || lower.includes('connection reset') || lower.includes('broken pipe') || lower.includes('connection aborted')) {
    return {
      title: 'Network Error',
      description: 'The connection was interrupted. Check your network connection and try again.',
      technical: error,
    };
  }
  if (lower.includes('cancelled') || lower.includes('canceled')) {
    return {
      title: 'Request Cancelled',
      description: 'The request was cancelled before a response was received.',
      technical: error,
    };
  }
  if (lower.includes('too many redirects') || lower.includes('redirect')) {
    return {
      title: 'Too Many Redirects',
      description: 'The request was redirected too many times. This may indicate a redirect loop.',
      technical: error,
    };
  }

  return {
    title: 'Request Failed',
    description: 'An error occurred while sending the request.',
    technical: error,
  };
}

export function ResponsePanel() {
  const response = useStore((s) => s.response);
  const responseError = useStore((s) => s.responseError);
  const isRequesting = useStore((s) => s.isRequesting);
  const isCancelled = useStore((s) => s.isCancelled);
  const [activeTab, setActiveTab] = useState('body');
  const [copied, setCopied] = useState(false);
  const [showFullResponse, setShowFullResponse] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  // Retry: simulate clicking the Send button by dispatching the same flow
  const handleRetry = () => {
    // Find and click the send button in the UrlBar
    const sendBtn = document.querySelector('[class*="sendButton"]') as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.click();
    }
  };

  if (isRequesting) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.spinner} />
          <p>Sending request...</p>
        </div>
      </div>
    );
  }

  if (responseError) {
    const classified = classifyError(responseError);
    const wasCancelled = isCancelled || classified.title === 'Request Cancelled';

    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          {wasCancelled ? (
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="4" width="40" height="40" stroke="var(--text-tertiary)" strokeWidth="2" />
              <rect x="16" y="16" width="16" height="16" fill="var(--text-tertiary)" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="4" width="40" height="40" stroke="#E1000F" strokeWidth="2" />
              <line x1="16" y1="16" x2="32" y2="32" stroke="#E1000F" strokeWidth="2" />
              <line x1="32" y1="16" x2="16" y2="32" stroke="#E1000F" strokeWidth="2" />
            </svg>
          )}
          <p className={wasCancelled ? styles.cancelledTitle : undefined}>{classified.title}</p>
          <p className={styles.errorDescription}>{classified.description}</p>
          {classified.technical !== classified.description && classified.technical !== classified.title && (
            <details className={styles.errorDetails}>
              <summary>Technical Details</summary>
              <p className={styles.errorMessage}>{classified.technical}</p>
            </details>
          )}
          {!wasCancelled && (
            <Button
              variant="secondary"
              className={styles.retryButton}
              onClick={handleRetry}
            >
              <RotateCw size={14} />
              RETRY
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <ArrowDown size={48} strokeWidth={1} className={styles.emptyIcon} />
          <p>Send a request to see the response.</p>
        </div>
      </div>
    );
  }

  const language = detectLanguage(response.body, response.headers);
  const rawFormatted = formatBody(response.body, language);
  const isLargeResponse = rawFormatted.length > MAX_DISPLAY_SIZE;
  const displayBody = isLargeResponse && !showFullResponse
    ? rawFormatted.slice(0, MAX_DISPLAY_SIZE)
    : rawFormatted;
  const responseSizeMB = (rawFormatted.length / (1024 * 1024)).toFixed(1);

  return (
    <div className={styles.container}>
      {/* Status Bar */}
      <div className={styles.statusBar}>
        <StatusBadge code={response.statusCode} text={response.statusText} />
        <span className={styles.statusItem}>
          <span className={styles.statusValue}>{response.time}</span> ms
        </span>
        <span className={styles.statusItem}>
          <span className={styles.statusValue}>{formatSize(response.size)}</span>
        </span>
        <div className={styles.statusActions}>
          <IconButton
            onClick={() => handleCopy(rawFormatted)}
            title={copied ? 'Copied' : 'Copy body'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={RESPONSE_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className={styles.body}>
        {activeTab === 'body' && (
          <>
            {isLargeResponse && !showFullResponse && (
              <div className={styles.truncationBanner}>
                <AlertTriangle size={14} />
                <span>
                  Response body is very large ({responseSizeMB} MB). Showing first 5 MB.
                </span>
                <button
                  className={styles.showFullButton}
                  onClick={() => setShowFullResponse(true)}
                >
                  Show full response
                </button>
              </div>
            )}
            {isLargeResponse && showFullResponse && (
              <div className={styles.truncationBanner}>
                <AlertTriangle size={14} />
                <span>
                  Showing full response ({responseSizeMB} MB). Editor may be slow.
                </span>
                <button
                  className={styles.showFullButton}
                  onClick={() => setShowFullResponse(false)}
                >
                  Truncate to 5 MB
                </button>
              </div>
            )}
            <CodeEditor value={displayBody} language={language} readOnly height="100%" />
          </>
        )}
        {activeTab === 'headers' && (
          <div className={styles.headersTable}>
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className={styles.headerRow}>
                <span className={styles.headerKey}>{key}</span>
                <span className={styles.headerValue}>{value}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'cookies' && (
          <CookiesViewer headers={response.headers} />
        )}
        {activeTab === 'tests' && (
          <div className={styles.testsContainer}>
            {response.scriptError && (
              <div className={styles.scriptError}>{response.scriptError}</div>
            )}
            {(response.testResults && response.testResults.length > 0) ? (
              <div className={styles.testResults}>
                {response.testResults.map((t, i) => (
                  <div key={i} className={`${styles.testRow} ${t.passed ? styles.testPassed : styles.testFailed}`}>
                    <span className={styles.testBadge}>{t.passed ? 'PASS' : 'FAIL'}</span>
                    <span className={styles.testName}>{t.name}</span>
                    {t.error && <span className={styles.testError}>{t.error}</span>}
                  </div>
                ))}
                <div className={styles.testSummary}>
                  {response.testResults.filter((t) => t.passed).length}/{response.testResults.length} passed
                </div>
              </div>
            ) : (
              <div className={styles.emptyTests}>
                No test results. Add assertions in the Tests tab of your request.
              </div>
            )}
            {response.consoleLog && response.consoleLog.length > 0 && (
              <div className={styles.consoleOutput}>
                <div className={styles.consoleHeader}>Console Output</div>
                {response.consoleLog.map((log, i) => (
                  <div key={i} className={styles.consoleLine}>{log}</div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'code' && (
          <CodeGenerator />
        )}
      </div>
    </div>
  );
}
