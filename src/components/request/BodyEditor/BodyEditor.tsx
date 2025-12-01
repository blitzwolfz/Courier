import { useStore } from '../../../stores';
import { CodeEditor } from '../../common/CodeEditor/CodeEditor';
import { GraphQLEditor } from '../GraphQLEditor/GraphQLEditor';
import type { BodyType } from '../../../types/request';
import styles from './BodyEditor.module.css';

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'text', label: 'Text' },
  { value: 'html', label: 'HTML' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'graphql', label: 'GraphQL' },
];

const BODY_TYPE_TO_LANGUAGE: Record<string, string> = {
  json: 'json',
  xml: 'xml',
  html: 'html',
  javascript: 'javascript',
  text: 'plaintext',
};

export function BodyEditor() {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);

  if (!activeRequest) return null;

  const { body } = activeRequest;

  return (
    <div className={styles.container}>
      <div className={styles.typeBar}>
        {BODY_TYPES.map((bt) => (
          <button
            key={bt.value}
            className={`${styles.typeButton} ${body.type === bt.value ? styles.typeButtonActive : ''}`}
            onClick={() => updateActiveRequest({ body: { ...body, type: bt.value } })}
          >
            {bt.label}
          </button>
        ))}
      </div>
      <div className={styles.editorArea}>
        {body.type === 'none' ? (
          <div className={styles.noneMessage}>This request does not have a body.</div>
        ) : body.type === 'graphql' ? (
          <GraphQLEditor />
        ) : (
          <CodeEditor
            value={body.content}
            onChange={(content) => updateActiveRequest({ body: { ...body, content } })}
            language={BODY_TYPE_TO_LANGUAGE[body.type] ?? 'plaintext'}
            height="100%"
          />
        )}
      </div>
    </div>
  );
}
