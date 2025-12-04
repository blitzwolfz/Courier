import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../../stores';
import { IconButton } from '../../common/IconButton/IconButton';
import { Button } from '../../common/Button/Button';
import styles from './EnvironmentsList.module.css';

export function EnvironmentsList() {
  const environments = useStore((s) => s.environments);
  const activeEnvironmentId = useStore((s) => s.activeEnvironmentId);
  const loadEnvironments = useStore((s) => s.loadEnvironments);
  const addEnvironment = useStore((s) => s.addEnvironment);
  const removeEnvironment = useStore((s) => s.removeEnvironment);
  const setActiveEnvironmentId = useStore((s) => s.setActiveEnvironmentId);

  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const handleCreate = async () => {
    if (newName.trim()) {
      await addEnvironment(newName.trim());
      setNewName('');
      setShowNewInput(false);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <span className={styles.title}>Environments</span>
        <IconButton onClick={() => setShowNewInput(!showNewInput)} title="New Environment">
          <Plus size={16} />
        </IconButton>
      </div>

      {showNewInput && (
        <div className={styles.newInput}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Environment name..."
            autoFocus
            style={{
              height: '28px',
              padding: '0 8px',
              border: '2px solid var(--color-primary)',
              borderRadius: '2px',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>
      )}

      <div className={styles.content}>
        {environments.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No environments yet.</p>
            <Button variant="secondary" onClick={() => setShowNewInput(true)}>
              Create Environment
            </Button>
          </div>
        ) : (
          environments.map((env) => (
            <div key={env.id} className={styles.envItem}>
              <input
                type="radio"
                className={styles.radio}
                checked={activeEnvironmentId === env.id}
                onChange={() => setActiveEnvironmentId(env.id)}
                name="active-env"
              />
              <span className={`${styles.envName} ${activeEnvironmentId === env.id ? styles.envActive : ''}`}>
                {env.name}
              </span>
              <IconButton
                className={styles.deleteBtn}
                onClick={() => removeEnvironment(env.id)}
                title="Delete"
              >
                <Trash2 size={12} />
              </IconButton>
            </div>
          ))
        )}
      </div>
    </>
  );
}
