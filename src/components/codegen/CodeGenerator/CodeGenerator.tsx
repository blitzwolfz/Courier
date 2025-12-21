import { useState, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { useStore } from '../../../stores';
import { CodeEditor } from '../../common/CodeEditor/CodeEditor';
import { Select } from '../../common/Select/Select';
import { IconButton } from '../../common/IconButton/IconButton';
import { generateCode } from '../../../utils/api';
import styles from './CodeGenerator.module.css';

const LANGUAGES = [
  { value: 'curl', label: 'cURL' },
  { value: 'javascript-fetch', label: 'JavaScript (Fetch)' },
  { value: 'javascript-axios', label: 'JavaScript (Axios)' },
  { value: 'python', label: 'Python (requests)' },
  { value: 'rust', label: 'Rust (reqwest)' },
  { value: 'go', label: 'Go (net/http)' },
  { value: 'java', label: 'Java (HttpClient)' },
  { value: 'csharp', label: 'C# (HttpClient)' },
  { value: 'php', label: 'PHP (cURL)' },
  { value: 'ruby', label: 'Ruby (Net::HTTP)' },
  { value: 'swift', label: 'Swift (URLSession)' },
];

const LANGUAGE_TO_MONACO: Record<string, string> = {
  curl: 'shell',
  'javascript-fetch': 'javascript',
  'javascript-axios': 'javascript',
  python: 'python',
  rust: 'rust',
  go: 'go',
  java: 'java',
  csharp: 'csharp',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
};

export function CodeGenerator() {
  const activeRequest = useStore((s) => s.activeRequest);
  const [language, setLanguage] = useState('curl');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback(async () => {
    if (!activeRequest || !activeRequest.url.trim()) {
      setCode('// Enter a URL and select a method to generate code.');
      return;
    }

    const headers: [string, string][] = activeRequest.headers
      .filter((h) => h.enabled && h.key)
      .map((h) => [h.key, h.value]);

    // Add auth headers
    if (activeRequest.auth.type === 'bearer' && activeRequest.auth.bearer?.token) {
      headers.push(['Authorization', `Bearer ${activeRequest.auth.bearer.token}`]);
    } else if (activeRequest.auth.type === 'basic' && activeRequest.auth.basic) {
      const encoded = btoa(`${activeRequest.auth.basic.username}:${activeRequest.auth.basic.password}`);
      headers.push(['Authorization', `Basic ${encoded}`]);
    } else if (activeRequest.auth.type === 'api-key' && activeRequest.auth.apiKey?.addTo === 'header') {
      headers.push([activeRequest.auth.apiKey.key, activeRequest.auth.apiKey.value]);
    }

    const body = activeRequest.body.type !== 'none' ? activeRequest.body.content : null;

    // Auto-add Content-Type for JSON body
    if (body && activeRequest.body.type === 'json') {
      const hasContentType = headers.some(([k]) => k.toLowerCase() === 'content-type');
      if (!hasContentType) {
        headers.push(['Content-Type', 'application/json']);
      }
    }

    try {
      const result = await generateCode(language, activeRequest.method, activeRequest.url, headers, body || null);
      setCode(result);
    } catch (err) {
      setCode(`// Error generating code: ${err}`);
    }
  }, [activeRequest, language]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          options={LANGUAGES}
          className={styles.langSelect}
        />
        <IconButton onClick={handleCopy} title={copied ? 'Copied' : 'Copy code'}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </IconButton>
      </div>
      <div className={styles.editorArea}>
        <CodeEditor
          value={code}
          language={LANGUAGE_TO_MONACO[language] ?? 'plaintext'}
          readOnly
          height="100%"
        />
      </div>
    </div>
  );
}
