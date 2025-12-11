import { useStore } from '../../../stores';
import { Select } from '../../common/Select/Select';
import { Input } from '../../common/Input/Input';
import type { AuthType, AuthConfig } from '../../../types/request';
import styles from './AuthEditor.module.css';

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'digest', label: 'Digest Auth' },
];

export function AuthEditor() {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);

  if (!activeRequest) return null;

  const { auth } = activeRequest;

  const updateAuth = (update: Partial<AuthConfig>) => {
    updateActiveRequest({ auth: { ...auth, ...update } });
  };

  return (
    <div className={styles.container}>
      <div className={styles.typeSelect}>
        <Select
          value={auth.type}
          onChange={(e) => updateAuth({ type: e.target.value as AuthType })}
          options={AUTH_TYPES}
        />
      </div>

      {auth.type === 'none' && (
        <div className={styles.noAuth}>
          This request does not use any authorization.
        </div>
      )}

      {auth.type === 'bearer' && (
        <div className={styles.field}>
          <span className={styles.label}>Token</span>
          <Input
            value={auth.bearer?.token ?? ''}
            onChange={(e) => updateAuth({ bearer: { token: e.target.value } })}
            placeholder="Enter token..."
            mono
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Username</span>
            <Input
              value={auth.basic?.username ?? ''}
              onChange={(e) =>
                updateAuth({ basic: { username: e.target.value, password: auth.basic?.password ?? '' } })
              }
              placeholder="Username"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Password</span>
            <Input
              type="password"
              value={auth.basic?.password ?? ''}
              onChange={(e) =>
                updateAuth({ basic: { username: auth.basic?.username ?? '', password: e.target.value } })
              }
              placeholder="Password"
            />
          </div>
        </>
      )}

      {auth.type === 'api-key' && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Key</span>
            <Input
              value={auth.apiKey?.key ?? ''}
              onChange={(e) =>
                updateAuth({
                  apiKey: { key: e.target.value, value: auth.apiKey?.value ?? '', addTo: auth.apiKey?.addTo ?? 'header' },
                })
              }
              placeholder="Key name"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Value</span>
            <Input
              value={auth.apiKey?.value ?? ''}
              onChange={(e) =>
                updateAuth({
                  apiKey: { key: auth.apiKey?.key ?? '', value: e.target.value, addTo: auth.apiKey?.addTo ?? 'header' },
                })
              }
              placeholder="Value"
              mono
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Add to</span>
            <Select
              value={auth.apiKey?.addTo ?? 'header'}
              onChange={(e) =>
                updateAuth({
                  apiKey: {
                    key: auth.apiKey?.key ?? '',
                    value: auth.apiKey?.value ?? '',
                    addTo: e.target.value as 'header' | 'query',
                  },
                })
              }
              options={[
                { value: 'header', label: 'Header' },
                { value: 'query', label: 'Query Param' },
              ]}
            />
          </div>
        </>
      )}

      {auth.type === 'oauth2' && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Access Token</span>
            <Input
              value={auth.oauth2?.token ?? ''}
              onChange={(e) =>
                updateAuth({
                  oauth2: { token: e.target.value, headerPrefix: auth.oauth2?.headerPrefix ?? 'Bearer' },
                })
              }
              placeholder="Enter access token..."
              mono
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Header Prefix</span>
            <Input
              value={auth.oauth2?.headerPrefix ?? 'Bearer'}
              onChange={(e) =>
                updateAuth({
                  oauth2: { token: auth.oauth2?.token ?? '', headerPrefix: e.target.value },
                })
              }
              placeholder="Bearer"
            />
          </div>
          <div className={styles.hint}>
            Token will be sent as: Authorization: {auth.oauth2?.headerPrefix || 'Bearer'} {'<token>'}
          </div>
        </>
      )}

      {auth.type === 'digest' && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Username</span>
            <Input
              value={auth.digest?.username ?? ''}
              onChange={(e) =>
                updateAuth({
                  digest: { username: e.target.value, password: auth.digest?.password ?? '' },
                })
              }
              placeholder="Username"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Password</span>
            <Input
              type="password"
              value={auth.digest?.password ?? ''}
              onChange={(e) =>
                updateAuth({
                  digest: { username: auth.digest?.username ?? '', password: e.target.value },
                })
              }
              placeholder="Password"
            />
          </div>
          <div className={styles.hint}>
            Digest auth will be handled automatically: an initial request fetches the challenge, then a second request sends the digest response.
          </div>
        </>
      )}
    </div>
  );
}
