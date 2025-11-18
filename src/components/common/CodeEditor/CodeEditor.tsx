import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useCallback } from 'react';
import { useStore } from '../../../stores';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  height = '100%',
}: CodeEditorProps) {
  const monaco = useMonaco();
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('courier-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'E1000F', fontStyle: 'bold' },
          { token: 'string', foreground: '00A650' },
          { token: 'number', foreground: 'FF6600' },
          { token: 'comment', foreground: '808080' },
          { token: 'type', foreground: 'E1000F' },
          { token: 'variable', foreground: '000000' },
          { token: 'string.key.json', foreground: 'B40000' },
          { token: 'string.value.json', foreground: '00A650' },
        ],
        colors: {
          'editor.background': '#FFFFFF',
          'editor.foreground': '#000000',
          'editor.lineHighlightBackground': '#F5F5F5',
          'editor.selectionBackground': '#E1000F33',
          'editorLineNumber.foreground': '#CCCCCC',
          'editorCursor.foreground': '#E1000F',
        },
      });

      monaco.editor.defineTheme('courier-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'FF4444', fontStyle: 'bold' },
          { token: 'string', foreground: '4EC970' },
          { token: 'number', foreground: 'FF8844' },
          { token: 'comment', foreground: '808080' },
          { token: 'type', foreground: 'FF4444' },
          { token: 'string.key.json', foreground: 'FF6666' },
          { token: 'string.value.json', foreground: '4EC970' },
        ],
        colors: {
          'editor.background': '#1A1A1A',
          'editor.foreground': '#E8E8E8',
          'editor.lineHighlightBackground': '#242424',
          'editor.selectionBackground': '#E1000F44',
          'editorLineNumber.foreground': '#555555',
          'editorCursor.foreground': '#E1000F',
        },
      });
    }
  }, [monaco]);

  const monacoTheme = theme === 'dark' ? 'courier-dark' : 'courier-light';

  const handleChange = useCallback(
    (val: string | undefined) => {
      if (onChange && val !== undefined) {
        onChange(val);
      }
    },
    [onChange]
  );

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={handleChange}
      theme={monacoTheme}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        renderLineHighlight: 'line',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
      }}
    />
  );
}
