import { useCallback } from 'react';
import { useStore } from '../../../stores';
import { CodeEditor } from '../../common/CodeEditor/CodeEditor';
import styles from './ScriptEditor.module.css';

interface ScriptEditorProps {
  type: 'pre-request' | 'tests';
}

const PRE_REQUEST_SNIPPETS = [
  { label: 'Set Variable', code: 'pm.variables.set("key", "value");\n' },
  { label: 'Get Variable', code: 'let val = pm.variables.get("key");\n' },
  { label: 'Set Env', code: 'pm.environment.set("key", "value");\n' },
  { label: 'Get Env', code: 'let val = pm.environment.get("key");\n' },
  { label: 'Log', code: 'console.log("message");\n' },
];

const TEST_SNIPPETS = [
  {
    label: 'Status Check',
    code: 'pm.test("Status is 200", function() {\n    return pm.response.status === 200;\n});\n',
  },
  {
    label: 'Body Contains',
    code: 'pm.test("Body contains key", function() {\n    var body = pm.response.json();\n    return body.hasOwnProperty("key");\n});\n',
  },
  {
    label: 'Response Time',
    code: 'pm.test("Response time < 500ms", function() {\n    return pm.response.responseTime < 500;\n});\n',
  },
  { label: 'Log Response', code: 'console.log(pm.response.body);\n' },
];

export function ScriptEditor({ type }: ScriptEditorProps) {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);

  const snippets = type === 'pre-request' ? PRE_REQUEST_SNIPPETS : TEST_SNIPPETS;
  const value =
    type === 'pre-request'
      ? activeRequest?.preRequestScript ?? ''
      : activeRequest?.testScript ?? '';

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (!activeRequest) return;
      if (type === 'pre-request') {
        updateActiveRequest({ preRequestScript: newValue ?? '' });
      } else {
        updateActiveRequest({ testScript: newValue ?? '' });
      }
    },
    [activeRequest, type, updateActiveRequest]
  );

  const handleInsertSnippet = useCallback(
    (code: string) => {
      if (!activeRequest) return;
      const currentValue = value;
      const newValue = currentValue ? currentValue + '\n' + code : code;
      handleChange(newValue);
    },
    [activeRequest, value, handleChange]
  );

  if (!activeRequest) return null;

  return (
    <div className={styles.container}>
      <div className={styles.snippetBar}>
        <span className={styles.snippetLabel}>Snippets:</span>
        {snippets.map((s) => (
          <button
            key={s.label}
            className={styles.snippetBtn}
            onClick={() => handleInsertSnippet(s.code)}
            title={s.code}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.editorContainer}>
        <CodeEditor
          value={value}
          language="javascript"
          onChange={handleChange}
          readOnly={false}
        />
      </div>
    </div>
  );
}
