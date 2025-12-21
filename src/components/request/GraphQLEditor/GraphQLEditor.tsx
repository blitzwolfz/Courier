import { useStore } from '../../../stores';
import { CodeEditor } from '../../common/CodeEditor/CodeEditor';
import styles from './GraphQLEditor.module.css';

const PLACEHOLDER_QUERY = `# Write your GraphQL query here
query {

}`;

const PLACEHOLDER_VARIABLES = `{

}`;

export function GraphQLEditor() {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);

  if (!activeRequest) return null;

  const { body } = activeRequest;

  // Parse stored content: we store { query, variables } as JSON in body.content
  let query = '';
  let variables = '';
  if (body.content) {
    try {
      const parsed = JSON.parse(body.content);
      query = parsed.query ?? '';
      variables = parsed.variables ?? '';
    } catch {
      // If not valid JSON, treat it as raw query
      query = body.content;
    }
  }

  const updateContent = (newQuery?: string, newVars?: string) => {
    const q = newQuery ?? query;
    const v = newVars ?? variables;
    updateActiveRequest({
      body: {
        ...body,
        content: JSON.stringify({ query: q, variables: v }),
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.pane}>
        <div className={styles.paneHeader}>
          <span className={styles.paneTitle}>QUERY</span>
        </div>
        <div className={styles.paneBody}>
          <CodeEditor
            value={query || PLACEHOLDER_QUERY}
            onChange={(val) => updateContent(val, undefined)}
            language="graphql"
            height="100%"
          />
        </div>
      </div>
      <div className={styles.divider} />
      <div className={styles.pane}>
        <div className={styles.paneHeader}>
          <span className={styles.paneTitle}>VARIABLES</span>
        </div>
        <div className={styles.paneBody}>
          <CodeEditor
            value={variables || PLACEHOLDER_VARIABLES}
            onChange={(val) => updateContent(undefined, val)}
            language="json"
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
