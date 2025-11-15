export interface TestResultData {
  name: string;
  passed: boolean;
  error: string | null;
}

export interface ResponseData {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  time: number;
  testResults?: TestResultData[];
  consoleLog?: string[];
  scriptError?: string | null;
}

export function getStatusColor(code: number): string {
  if (code >= 200 && code < 300) return 'var(--color-success)';
  if (code >= 300 && code < 400) return 'var(--color-warning)';
  return 'var(--color-primary)';
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
