import type { HttpMethod } from '../../../types/request';
import { METHOD_COLORS } from '../../../types/request';
import { getStatusColor } from '../../../types/response';
import styles from './Badge.module.css';

interface MethodBadgeProps {
  method: HttpMethod;
}

export function MethodBadge({ method }: MethodBadgeProps) {
  const color = METHOD_COLORS[method] ?? 'var(--color-gray)';
  return (
    <span
      className={`${styles.badge} ${styles.method}`}
      style={{ backgroundColor: color }}
    >
      {method}
    </span>
  );
}

interface StatusBadgeProps {
  code: number;
  text?: string;
}

export function StatusBadge({ code, text }: StatusBadgeProps) {
  const color = getStatusColor(code);
  return (
    <span className={`${styles.badge} ${styles.status}`} style={{ color }}>
      {code} {text ?? ''}
    </span>
  );
}
