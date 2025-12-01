import { useStore } from '../../../stores';
import { KeyValueEditor } from '../../common/KeyValueEditor/KeyValueEditor';

export function HeadersEditor() {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);

  if (!activeRequest) return null;

  return (
    <KeyValueEditor
      pairs={activeRequest.headers}
      onChange={(headers) => updateActiveRequest({ headers })}
      keyPlaceholder="Header"
      valuePlaceholder="Value"
    />
  );
}
