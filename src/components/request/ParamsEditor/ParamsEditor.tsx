import { useStore } from '../../../stores';
import { KeyValueEditor } from '../../common/KeyValueEditor/KeyValueEditor';

export function ParamsEditor() {
  const activeRequest = useStore((s) => s.activeRequest);
  const updateActiveRequest = useStore((s) => s.updateActiveRequest);

  if (!activeRequest) return null;

  return (
    <KeyValueEditor
      pairs={activeRequest.params}
      onChange={(params) => updateActiveRequest({ params })}
      keyPlaceholder="Parameter"
      valuePlaceholder="Value"
    />
  );
}
