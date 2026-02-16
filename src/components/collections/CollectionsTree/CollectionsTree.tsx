import { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronRight, Trash2, Plus, Upload, Download, Play, FolderPlus, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../../../stores';
import { MethodBadge } from '../../common/Badge/Badge';
import { IconButton } from '../../common/IconButton/IconButton';
import { Button } from '../../common/Button/Button';
import { createEmptyRequest, type HttpMethod, type RequestData } from '../../../types/request';
import { CollectionRunner } from '../../runner/CollectionRunner/CollectionRunner';
import { moveCollection, moveRequest } from '../../../utils/api';
import type { Collection } from '../../../types/collection';
import styles from './CollectionsTree.module.css';

interface DragItem {
  type: 'collection' | 'request';
  id: string;
  collectionId?: string | null;
}

export function CollectionsTree() {
  const collections = useStore((s) => s.collections);
  const collectionRequests = useStore((s) => s.collectionRequests);
  const loadCollections = useStore((s) => s.loadCollections);
  const addCollection = useStore((s) => s.addCollection);
  const removeCollection = useStore((s) => s.removeCollection);
  const loadCollectionRequests = useStore((s) => s.loadCollectionRequests);
  const openTab = useStore((s) => s.openTab);
  const saveRequest = useStore((s) => s.saveRequest);
  const importPostmanCollection = useStore((s) => s.importPostmanCollection);
  const exportPostmanCollection = useStore((s) => s.exportPostmanCollection);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [newSubfolderParent, setNewSubfolderParent] = useState<string | null>(null);
  const [subfolderName, setSubfolderName] = useState('');
  const [runnerCollection, setRunnerCollection] = useState<{ id: string; name: string } | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        loadCollectionRequests(id);
      }
      return next;
    });
  };

  const handleCreateCollection = async () => {
    if (newName.trim()) {
      await addCollection(newName.trim());
      setNewName('');
      setShowNewInput(false);
    }
  };

  const handleCreateSubfolder = async (parentId: string) => {
    if (subfolderName.trim()) {
      // Use the raw API to create with parent
      const { createCollection } = await import('../../../utils/api');
      await createCollection(subfolderName.trim());
      // After creation, move it under parent
      const updatedCollections = useStore.getState().collections;
      await loadCollections();
      const latestColls = useStore.getState().collections;
      const newColl = latestColls.find(
        (c) => c.name === subfolderName.trim() && !updatedCollections.find((uc) => uc.id === c.id)
      );
      if (newColl) {
        await moveCollection(newColl.id, parentId);
        await loadCollections();
      }
      setSubfolderName('');
      setNewSubfolderParent(null);
    }
  };

  const handleAddRequest = async (collectionId: string) => {
    const req = createEmptyRequest(uuidv4());
    req.collectionId = collectionId;
    req.name = 'New Request';
    await saveRequest(req);
    openTab(req);
  };

  const handleOpenRequest = (request: RequestData) => {
    openTab(request);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importPostmanCollection(text);
    } catch (err) {
      console.error('Import failed:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async (collectionId: string, collectionName: string) => {
    try {
      const json = await exportPostmanCollection(collectionId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collectionName.replace(/[^a-zA-Z0-9]/g, '_')}.postman_collection.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragItem | undefined;
    if (data) setActiveDrag(data);
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as DragItem | undefined;
    const overData = over.data.current as { type: string; collectionId?: string } | undefined;

    if (!activeData) return;

    try {
      if (activeData.type === 'request' && overData?.type === 'collection-drop') {
        // Move request to a different collection
        await moveRequest(String(active.id), String(over.id), 0);
        // Reload both source and target collections
        if (activeData.collectionId) loadCollectionRequests(activeData.collectionId);
        loadCollectionRequests(String(over.id));
      } else if (activeData.type === 'collection' && overData?.type === 'collection-drop') {
        // Move collection under another collection as subfolder
        await moveCollection(String(active.id), String(over.id));
        loadCollections();
      }
    } catch (err) {
      console.error('Drag operation failed:', err);
    }
  }, [loadCollections, loadCollectionRequests]);

  // Get children of a parent (null = top-level)
  const getChildren = (parentId: string | null) =>
    collections.filter((c) => (c.parentId ?? null) === parentId);

  // Recursive render
  const renderCollection = (coll: Collection, depth: number) => {
    const children = getChildren(coll.id);
    const requests = collectionRequests[coll.id] ?? [];
    const isExpanded = expanded.has(coll.id);

    return (
      <CollectionItem
        key={coll.id}
        collection={coll}
        depth={depth}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpand}
        onAddRequest={handleAddRequest}
        onExport={handleExport}
        onDelete={removeCollection}
        onRun={(id, name) => setRunnerCollection({ id, name })}
        onAddSubfolder={(id) => {
          setNewSubfolderParent(id);
          setSubfolderName('');
        }}
      >
        {newSubfolderParent === coll.id && (
          <div style={{ padding: '4px 12px', paddingLeft: (depth + 1) * 16 + 12 }}>
            <input
              value={subfolderName}
              onChange={(e) => setSubfolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSubfolder(coll.id)}
              onBlur={() => { if (!subfolderName.trim()) setNewSubfolderParent(null); }}
              placeholder="Subfolder name..."
              autoFocus
              style={{
                height: '24px',
                padding: '0 6px',
                border: '2px solid var(--color-primary)',
                borderRadius: '2px',
                fontSize: '12px',
                width: '100%',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        )}
        {isExpanded && (
          <>
            {children.map((child) => renderCollection(child, depth + 1))}
            {requests.map((req) => (
              <RequestItem
                key={req.id}
                request={req}
                depth={depth + 1}
                collectionId={coll.id}
                onOpen={handleOpenRequest}
              />
            ))}
          </>
        )}
      </CollectionItem>
    );
  };

  const topLevel = getChildren(null);

  return (
    <>
      <div className={styles.header}>
        <span className={styles.title}>Collections</span>
        <div className={styles.headerActions}>
          <IconButton onClick={handleImport} title="Import Postman Collection">
            <Upload size={14} />
          </IconButton>
          <IconButton onClick={() => setShowNewInput(!showNewInput)} title="New Collection">
            <Plus size={16} />
          </IconButton>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {showNewInput && (
        <div style={{ padding: '4px 12px' }}>
          <input
            className={styles.newInput}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
            onBlur={() => { if (!newName.trim()) setShowNewInput(false); }}
            placeholder="Collection name..."
            autoFocus
            style={{
              height: '28px',
              padding: '0 8px',
              border: '2px solid var(--color-primary)',
              borderRadius: '2px',
              fontSize: '13px',
              width: '100%',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      )}

      <div className={styles.content}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {topLevel.length === 0 && collections.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No collections yet.</p>
              <Button variant="secondary" onClick={() => setShowNewInput(true)}>
                Create Collection
              </Button>
            </div>
          ) : (
            topLevel.map((coll) => renderCollection(coll, 0))
          )}
          <DragOverlay>
            {activeDrag && (
              <div className={styles.dragOverlay}>
                {activeDrag.type === 'request' ? 'Moving request...' : 'Moving collection...'}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {runnerCollection && (
        <CollectionRunner
          collectionId={runnerCollection.id}
          collectionName={runnerCollection.name}
          onClose={() => setRunnerCollection(null)}
        />
      )}
    </>
  );
}

// Droppable + draggable collection item
interface CollectionItemProps {
  collection: Collection;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onAddRequest: (id: string) => void;
  onExport: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRun: (id: string, name: string) => void;
  onAddSubfolder: (id: string) => void;
  children?: React.ReactNode;
}

function CollectionItem({
  collection,
  depth,
  isExpanded,
  onToggleExpand,
  onAddRequest,
  onExport,
  onDelete,
  onRun,
  onAddSubfolder,
  children,
}: CollectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({
    id: collection.id,
    data: { type: 'collection-drop', collectionId: collection.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.collectionItem} ${isOver ? styles.collectionDropTarget : ''}`}
    >
      <div
        className={styles.collectionHeader}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => onToggleExpand(collection.id)}
      >
        <span className={styles.dragHandle} {...attributes} {...listeners}>
          <GripVertical size={10} />
        </span>
        <ChevronRight
          size={14}
          className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
        />
        <span className={styles.collectionName}>{collection.name}</span>
        <IconButton
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onRun(collection.id, collection.name); }}
          title="Run Collection"
        >
          <Play size={12} />
        </IconButton>
        <IconButton
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onExport(collection.id, collection.name); }}
          title="Export as Postman JSON"
        >
          <Download size={12} />
        </IconButton>
        <IconButton
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onAddSubfolder(collection.id); }}
          title="New Subfolder"
        >
          <FolderPlus size={12} />
        </IconButton>
        <IconButton
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onAddRequest(collection.id); }}
          title="Add Request"
        >
          <Plus size={12} />
        </IconButton>
        <IconButton
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(collection.id); }}
          title="Delete"
        >
          <Trash2 size={12} />
        </IconButton>
      </div>
      {children}
    </div>
  );
}

// Draggable request item
interface RequestItemProps {
  request: RequestData;
  depth: number;
  collectionId: string;
  onOpen: (req: RequestData) => void;
}

function RequestItem({ request, depth, collectionId, onOpen }: RequestItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: request.id,
    data: { type: 'request', id: request.id, collectionId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: depth * 16 + 12,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.requestItem}
      onClick={() => onOpen(request)}
      {...attributes}
      {...listeners}
    >
      <MethodBadge method={(request.method || 'GET') as HttpMethod} />
      <span className={styles.requestName}>{request.name}</span>
    </div>
  );
}
