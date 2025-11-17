import { v4 as uuidv4 } from 'uuid';
import { Trash2 } from 'lucide-react';
import { IconButton } from '../IconButton/IconButton';
import type { KeyValuePair } from '../../../types/request';
import styles from './KeyValueEditor.module.css';

interface KeyValueEditorProps {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
  const updatePair = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    onChange(updated);
  };

  const removePair = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  const addPair = () => {
    onChange([...pairs, { id: uuidv4(), key: '', value: '', enabled: true }]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerCheckbox} />
        <div className={styles.headerKey}>{keyPlaceholder}</div>
        <div className={styles.headerValue}>{valuePlaceholder}</div>
        <div className={styles.headerAction} />
      </div>
      {pairs.map((pair, index) => (
        <div key={pair.id} className={styles.row}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={pair.enabled}
            onChange={(e) => updatePair(index, 'enabled', e.target.checked)}
          />
          <input
            className={styles.keyInput}
            value={pair.key}
            onChange={(e) => updatePair(index, 'key', e.target.value)}
            placeholder={keyPlaceholder}
          />
          <input
            className={styles.valueInput}
            value={pair.value}
            onChange={(e) => updatePair(index, 'value', e.target.value)}
            placeholder={valuePlaceholder}
          />
          <IconButton
            className={styles.deleteBtn}
            onClick={() => removePair(index)}
            title="Remove"
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      <div className={styles.addRow}>
        <button className={styles.addBtn} onClick={addPair}>
          + Add
        </button>
      </div>
    </div>
  );
}
