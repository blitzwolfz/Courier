import { useMemo } from 'react';
import styles from './CookiesViewer.module.css';

interface CookieInfo {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

function parseCookies(headers: Record<string, string>): CookieInfo[] {
  const cookies: CookieInfo[] = [];

  // Look for set-cookie header(s)
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      // Could be multiple cookies separated by newlines (server-joined)
      const cookieStrings = value.split(/(?<=\S),\s*(?=[A-Za-z_]+=)/);
      for (const cookieStr of cookieStrings) {
        const parts = cookieStr.split(';').map((p) => p.trim());
        const [first, ...attrs] = parts;
        if (!first) continue;

        const eqIdx = first.indexOf('=');
        if (eqIdx < 0) continue;

        const cookie: CookieInfo = {
          name: first.substring(0, eqIdx).trim(),
          value: first.substring(eqIdx + 1).trim(),
          domain: '',
          path: '/',
          expires: '',
          httpOnly: false,
          secure: false,
          sameSite: '',
        };

        for (const attr of attrs) {
          const lower = attr.toLowerCase();
          if (lower === 'httponly') {
            cookie.httpOnly = true;
          } else if (lower === 'secure') {
            cookie.secure = true;
          } else if (lower.startsWith('domain=')) {
            cookie.domain = attr.substring(7).trim();
          } else if (lower.startsWith('path=')) {
            cookie.path = attr.substring(5).trim();
          } else if (lower.startsWith('expires=')) {
            cookie.expires = attr.substring(8).trim();
          } else if (lower.startsWith('max-age=')) {
            const seconds = parseInt(attr.substring(8).trim(), 10);
            if (!isNaN(seconds)) {
              const expDate = new Date(Date.now() + seconds * 1000);
              cookie.expires = expDate.toUTCString();
            }
          } else if (lower.startsWith('samesite=')) {
            cookie.sameSite = attr.substring(9).trim();
          }
        }

        cookies.push(cookie);
      }
    }
  }

  return cookies;
}

interface CookiesViewerProps {
  headers: Record<string, string>;
}

export function CookiesViewer({ headers }: CookiesViewerProps) {
  const cookies = useMemo(() => parseCookies(headers), [headers]);

  if (cookies.length === 0) {
    return (
      <div className={styles.emptyState}>
        No cookies in this response.
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Value</th>
            <th className={styles.th}>Domain</th>
            <th className={styles.th}>Path</th>
            <th className={styles.th}>Expires</th>
            <th className={styles.thCenter}>HttpOnly</th>
            <th className={styles.thCenter}>Secure</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((cookie, i) => (
            <tr key={`${cookie.name}-${i}`} className={styles.row}>
              <td className={styles.tdName}>{cookie.name}</td>
              <td className={styles.tdValue}>{cookie.value}</td>
              <td className={styles.td}>{cookie.domain || '-'}</td>
              <td className={styles.td}>{cookie.path}</td>
              <td className={styles.td}>{cookie.expires || 'Session'}</td>
              <td className={styles.tdCenter}>{cookie.httpOnly ? 'Y' : '-'}</td>
              <td className={styles.tdCenter}>{cookie.secure ? 'Y' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
