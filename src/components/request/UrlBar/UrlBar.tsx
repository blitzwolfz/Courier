import { useRef } from 'react';
import { useStore } from '../../../stores';
import { Select } from '../../common/Select/Select';
import { Input } from '../../common/Input/Input';
import { Button } from '../../common/Button/Button';
import { HTTP_METHODS, type HttpMethod } from '../../../types/request';
import { sendRequest as apiSendRequest } from '../../../utils/api';
import { buildVariableMap, interpolateVariables } from '../../../utils/variables';
import styles from './UrlBar.module.css';

let requestCounter = 0;

export function UrlBar() {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);
  const setResponse = useStore((s) => s.setResponse);
  const setResponseError = useStore((s) => s.setResponseError);
  const setIsRequesting = useStore((s) => s.setIsRequesting);
  const isRequesting = useStore((s) => s.isRequesting);
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const loadHistory = useStore((s) => s.loadHistory);
  const setRequestId = useStore((s) => s.setRequestId);
  const cancelRequest = useStore((s) => s.cancelRequest);

  const currentRequestId = useRef<string | null>(null);

  const handleCancel = () => {
    currentRequestId.current = null;
    cancelRequest();
  };

  const handleSend = async () => {
    if (!activeRequest || !activeRequest.url.trim()) return;

    // Generate a unique ID for this request
    requestCounter += 1;
    const thisRequestId = `req_${Date.now()}_${requestCounter}`;
    currentRequestId.current = thisRequestId;

    setIsRequesting(true);
    setRequestId(thisRequestId);
    // Reset cancelled state
    useStore.setState({ isCancelled: false });

    try {
      const vars = buildVariableMap(environments, activeEnvironmentId);
      let url = interpolateVariables(activeRequest.url, vars);

      // Append enabled params to URL
      const enabledParams = activeRequest.params.filter((p) => p.enabled && p.key);
      if (enabledParams.length > 0) {
        const separator = url.includes('?') ? '&' : '?';
        const qs = enabledParams
          .map((p) => `${encodeURIComponent(interpolateVariables(p.key, vars))}=${encodeURIComponent(interpolateVariables(p.value, vars))}`)
          .join('&');
        url = `${url}${separator}${qs}`;
      }

      const headers: [string, string][] = activeRequest.headers
        .filter((h) => h.enabled && h.key)
        .map((h) => [
          interpolateVariables(h.key, vars),
          interpolateVariables(h.value, vars),
        ]);

      // Add auth headers
      if (activeRequest.auth.type === 'bearer' && activeRequest.auth.bearer?.token) {
        headers.push(['Authorization', `Bearer ${interpolateVariables(activeRequest.auth.bearer.token, vars)}`]);
      } else if (activeRequest.auth.type === 'basic' && activeRequest.auth.basic) {
        const encoded = btoa(`${activeRequest.auth.basic.username}:${activeRequest.auth.basic.password}`);
        headers.push(['Authorization', `Basic ${encoded}`]);
      } else if (activeRequest.auth.type === 'api-key' && activeRequest.auth.apiKey) {
        if (activeRequest.auth.apiKey.addTo === 'query') {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}${encodeURIComponent(activeRequest.auth.apiKey.key)}=${encodeURIComponent(activeRequest.auth.apiKey.value)}`;
        } else {
          headers.push([activeRequest.auth.apiKey.key, activeRequest.auth.apiKey.value]);
        }
      } else if (activeRequest.auth.type === 'oauth2' && activeRequest.auth.oauth2?.token) {
        const prefix = activeRequest.auth.oauth2.headerPrefix || 'Bearer';
        headers.push(['Authorization', `${prefix} ${interpolateVariables(activeRequest.auth.oauth2.token, vars)}`]);
      } else if (activeRequest.auth.type === 'digest' && activeRequest.auth.digest) {
        // Digest auth: send username/password as special headers for Rust backend to handle
        headers.push(['X-Courier-Digest-Username', activeRequest.auth.digest.username]);
        headers.push(['X-Courier-Digest-Password', activeRequest.auth.digest.password]);
      }

      // Body
      let body: string | null = null;
      if (activeRequest.body.type !== 'none' && activeRequest.body.content) {
        const hasContentType = headers.some(([k]) => k.toLowerCase() === 'content-type');

        if (activeRequest.body.type === 'graphql') {
          // GraphQL: parse stored { query, variables } and send as JSON POST
          try {
            const parsed = JSON.parse(activeRequest.body.content);
            const gqlBody: Record<string, unknown> = {
              query: interpolateVariables(parsed.query ?? '', vars),
            };
            if (parsed.variables) {
              const interpolated = interpolateVariables(parsed.variables, vars);
              try {
                gqlBody.variables = JSON.parse(interpolated);
              } catch {
                gqlBody.variables = interpolated;
              }
            }
            body = JSON.stringify(gqlBody);
          } catch {
            body = interpolateVariables(activeRequest.body.content, vars);
          }
          if (!hasContentType) {
            headers.push(['Content-Type', 'application/json']);
          }
        } else {
          body = interpolateVariables(activeRequest.body.content, vars);
          if (!hasContentType && activeRequest.body.type === 'json') {
            headers.push(['Content-Type', 'application/json']);
          }
        }
      }

      // Build environment map for scripting
      const envMap: Record<string, string> = {};
      const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
      if (activeEnv) {
        for (const v of activeEnv.variables) {
          if (v.key) envMap[v.key] = v.value;
        }
      }

      const result = await apiSendRequest(
        activeRequest.method,
        url,
        headers,
        body,
        {
          preRequestScript: activeRequest.preRequestScript || undefined,
          testScript: activeRequest.testScript || undefined,
          environment: Object.keys(envMap).length > 0 ? envMap : undefined,
        }
      );

      // If this request was cancelled while in-flight, discard the response
      if (currentRequestId.current !== thisRequestId) {
        return;
      }

      // result is now { response, test_results, console_log, script_error }
      const responseData = {
        statusCode: result.response.status_code,
        statusText: result.response.status_text,
        headers: result.response.headers,
        body: result.response.body,
        size: result.response.size,
        time: result.response.time,
        testResults: result.test_results,
        consoleLog: result.console_log,
        scriptError: result.script_error,
      };
      setResponse(responseData);
      loadHistory();
    } catch (err) {
      // If cancelled while in-flight, don't overwrite the cancelled state
      if (currentRequestId.current !== thisRequestId) {
        return;
      }
      setResponseError(err instanceof Error ? err.message : String(err));
    } finally {
      // Only clear isRequesting if this is still the active request
      if (currentRequestId.current === thisRequestId) {
        setIsRequesting(false);
        setRequestId(null);
      }
    }
  };

  if (!activeRequest) return null;

  return (
    <div className={styles.urlBar}>
      <Select
        className={styles.methodSelect}
        value={activeRequest.method}
        onChange={(e) => updateActiveRequest({ method: e.target.value as HttpMethod })}
        options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
      />
      <Input
        className={styles.urlInput}
        value={activeRequest.url}
        onChange={(e) => updateActiveRequest({ url: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && handleSend()}
        placeholder="Enter URL or paste cURL..."
        mono
      />
      {isRequesting ? (
        <Button
          className={styles.cancelButton}
          variant="danger"
          onClick={handleCancel}
        >
          CANCEL
        </Button>
      ) : (
        <Button
          className={styles.sendButton}
          onClick={handleSend}
        >
          SEND
        </Button>
      )}
    </div>
  );
}
