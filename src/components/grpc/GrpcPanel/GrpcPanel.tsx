import { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, Send, Plus, Trash2, ChevronRight, ChevronDown, Search } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { Input } from '../../common/Input/Input';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/IconButton/IconButton';
import { useStore } from '../../../stores';
import * as api from '../../../utils/api';
import type { ProtoDefinition, ProtoService, ProtoMethod, ProtoMessage, GrpcResponse } from '../../../utils/api';
import styles from './GrpcPanel.module.css';

type ActiveTab = 'message' | 'metadata' | 'schema';
type ResponseTab = 'response' | 'stream';

export function GrpcPanel() {
  const theme = useStore((s) => s.theme);

  const [url, setUrl] = useState('http://localhost:50051');
  const [definition, setDefinition] = useState<ProtoDefinition | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<ProtoMethod | null>(null);
  const [messageBody, setMessageBody] = useState('{\n  \n}');
  const [metadata, setMetadata] = useState<{ key: string; value: string }[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('message');
  const [responseTab, setResponseTab] = useState<ResponseTab>('response');
  const [response, setResponse] = useState<GrpcResponse | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protoError, setProtoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadProto = useCallback(async (content: string) => {
    setProtoError(null);
    try {
      const def = await api.loadProto(content);
      setDefinition(def);
      // Auto-select first service/method
      if (def.services.length > 0) {
        setSelectedService(def.services[0].full_name);
        if (def.services[0].methods.length > 0) {
          setSelectedMethod(def.services[0].methods[0]);
          // Generate template body from message fields
          const inputType = def.services[0].methods[0].input_type;
          const msg = def.messages.find((m) => m.full_name === inputType);
          if (msg) {
            setMessageBody(generateTemplate(msg.fields));
          }
        }
      }
    } catch (err) {
      setProtoError(String(err));
      setDefinition(null);
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleLoadProto(text);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleLoadProto]);

  const handleSelectMethod = useCallback((service: ProtoService, method: ProtoMethod) => {
    setSelectedService(service.full_name);
    setSelectedMethod(method);
    // Generate template body
    if (definition) {
      const msg = definition.messages.find((m) => m.full_name === method.input_type);
      if (msg) {
        setMessageBody(generateTemplate(msg.fields));
      }
    }
  }, [definition]);

  const handleSend = useCallback(async () => {
    if (!selectedService || !selectedMethod || !url.trim()) return;
    setSending(true);
    setError(null);
    setResponse(null);

    const meta: [string, string][] = metadata
      .filter((m) => m.key.trim())
      .map((m) => [m.key, m.value]);

    try {
      let result: GrpcResponse;
      if (selectedMethod.server_streaming) {
        result = await api.grpcServerStreamCall(
          url, selectedService, selectedMethod.name, messageBody, meta
        );
        setResponseTab('stream');
      } else {
        result = await api.grpcUnaryCall(
          url, selectedService, selectedMethod.name, messageBody, meta
        );
        setResponseTab('response');
      }
      setResponse(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }, [url, selectedService, selectedMethod, messageBody, metadata]);

  const addMetadataRow = () => {
    setMetadata([...metadata, { key: '', value: '' }]);
  };

  const updateMetadata = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...metadata];
    updated[index] = { ...updated[index], [field]: value };
    setMetadata(updated);
  };

  const removeMetadata = (index: number) => {
    setMetadata(metadata.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <Input
          className={styles.urlInput}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="grpc://localhost:50051"
          mono
        />
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={sending || !selectedMethod}
        >
          <Send size={14} />
          <span>{sending ? 'SENDING...' : 'INVOKE'}</span>
        </Button>
      </div>

      <div className={styles.workspace}>
        {/* Left: Proto & Service Tree */}
        <div className={styles.leftPanel}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Proto Definition</div>
            {!definition ? (
              <>
                <div
                  className={styles.protoUpload}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={20} />
                  <span>Load .proto file</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".proto"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                {protoError && (
                  <div className={styles.errorText}>{protoError}</div>
                )}
              </>
            ) : (
              <div className={styles.protoLoaded}>
                {definition.services.length} service(s), {definition.messages.length} message(s)
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDefinition(null);
                    setSelectedService(null);
                    setSelectedMethod(null);
                  }}
                  style={{ marginLeft: 8, padding: '2px 6px', fontSize: '11px' }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {definition && (
            <div className={styles.protoArea}>
              <div className={styles.sectionLabel}>Services</div>
              {definition.services.map((svc) => (
                <div key={svc.full_name} className={styles.serviceItem}>
                  <div className={styles.serviceName}>{svc.name}</div>
                  {svc.methods.map((method) => (
                    <div
                      key={method.full_name}
                      className={`${styles.methodItem} ${
                        selectedMethod?.full_name === method.full_name
                          ? styles.methodItemActive
                          : ''
                      }`}
                      onClick={() => handleSelectMethod(svc, method)}
                    >
                      <span
                        className={`${styles.methodBadge} ${
                          method.server_streaming ? styles.methodBadgeStream : ''
                        }`}
                      >
                        {method.server_streaming ? 'SS' : 'U'}
                      </span>
                      <span>{method.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Request/Response */}
        <div className={styles.rightPanel}>
          {/* Request tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'message' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('message')}
            >
              Message
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'metadata' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('metadata')}
            >
              Metadata
            </button>
            {definition && (
              <button
                className={`${styles.tab} ${activeTab === 'schema' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('schema')}
              >
                Schema
              </button>
            )}
          </div>

          {/* Message editor */}
          {activeTab === 'message' && (
            <div className={styles.editorArea}>
              {selectedMethod ? (
                <Editor
                  height="100%"
                  language="json"
                  theme={theme === 'dark' ? 'courier-dark' : 'courier-light'}
                  value={messageBody}
                  onChange={(v) => setMessageBody(v ?? '{}')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              ) : (
                <div className={styles.emptyState}>
                  <span>Load a .proto file and select a method</span>
                </div>
              )}
            </div>
          )}

          {/* Metadata editor */}
          {activeTab === 'metadata' && (
            <div className={styles.metadataEditor}>
              {metadata.map((row, i) => (
                <div key={i} className={styles.metaRow}>
                  <Input
                    className={styles.metaInput}
                    value={row.key}
                    onChange={(e) => updateMetadata(i, 'key', e.target.value)}
                    placeholder="Key"
                    mono
                  />
                  <Input
                    className={styles.metaInput}
                    value={row.value}
                    onChange={(e) => updateMetadata(i, 'value', e.target.value)}
                    placeholder="Value"
                    mono
                  />
                  <IconButton onClick={() => removeMetadata(i)} title="Remove">
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              ))}
              <Button variant="secondary" onClick={addMetadataRow}>
                <Plus size={12} /> Add Metadata
              </Button>
            </div>
          )}

          {/* Schema explorer */}
          {activeTab === 'schema' && definition && (
            <SchemaExplorer messages={definition.messages} />
          )}

          {/* Response area */}
          {(response || error) && (
            <>
              <div className={styles.responseHeader}>
                <strong>Response</strong>
                {response && (
                  <span className={styles.responseTime}>{response.time}ms</span>
                )}
                {response?.messages && (
                  <>
                    <button
                      className={`${styles.tab} ${responseTab === 'response' ? styles.tabActive : ''}`}
                      onClick={() => setResponseTab('response')}
                    >
                      Combined
                    </button>
                    <button
                      className={`${styles.tab} ${responseTab === 'stream' ? styles.tabActive : ''}`}
                      onClick={() => setResponseTab('stream')}
                    >
                      Stream ({response.messages.length})
                    </button>
                  </>
                )}
              </div>

              {error && <div className={styles.errorText}>{error}</div>}

              {response && responseTab === 'response' && (
                <div className={styles.responseArea}>{response.body}</div>
              )}

              {response?.messages && responseTab === 'stream' && (
                <div className={styles.streamMessages}>
                  {response.messages.map((msg, i) => (
                    <div key={i} className={styles.streamMessage}>
                      <div className={styles.streamIndex}>Message #{i + 1}</div>
                      {msg}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {sending && (
            <div className={styles.loading}>Sending gRPC request...</div>
          )}
        </div>
      </div>
    </div>
  );
}

const PRIMITIVE_TYPES = new Set([
  'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
  'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
  'bool', 'string', 'bytes',
]);

function SchemaExplorer({ messages }: { messages: ProtoMessage[] }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlightedMessage, setHighlightedMessage] = useState<string | null>(null);

  const filteredMessages = useMemo(() => {
    if (!search.trim()) return messages;
    const query = search.toLowerCase();
    return messages.filter((msg) => {
      const nameMatch = msg.full_name.toLowerCase().includes(query);
      const fieldMatch = msg.fields.some(
        (f) => f.name.toLowerCase().includes(query) || f.field_type.toLowerCase().includes(query)
      );
      return nameMatch || fieldMatch;
    });
  }, [messages, search]);

  const messageNames = useMemo(
    () => new Set(messages.map((m) => m.full_name)),
    [messages]
  );

  const toggleExpanded = (fullName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  };

  const jumpToMessage = (fullName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(fullName);
      return next;
    });
    setHighlightedMessage(fullName);
    setTimeout(() => setHighlightedMessage(null), 1200);
    // Scroll to the message element
    const el = document.getElementById(`schema-msg-${fullName}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const shortName = (fullName: string) => {
    const parts = fullName.split('.');
    return parts[parts.length - 1];
  };

  return (
    <div className={styles.schemaExplorer}>
      <div className={styles.schemaSearch}>
        <Search size={13} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages and fields..."
          className={styles.schemaSearchInput}
        />
      </div>
      <div className={styles.schemaList}>
        {filteredMessages.length === 0 && (
          <div className={styles.emptyState}>
            <span>No messages found</span>
          </div>
        )}
        {filteredMessages.map((msg) => {
          const isExpanded = expanded.has(msg.full_name);
          const isHighlighted = highlightedMessage === msg.full_name;
          return (
            <div
              key={msg.full_name}
              id={`schema-msg-${msg.full_name}`}
              className={`${styles.messageItem} ${isHighlighted ? styles.messageItemHighlight : ''}`}
            >
              <div
                className={styles.messageHeader}
                onClick={() => toggleExpanded(msg.full_name)}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className={styles.messageName}>{shortName(msg.full_name)}</span>
                <span className={styles.messageFullName}>{msg.full_name}</span>
                <span className={styles.fieldCount}>{msg.fields.length} fields</span>
              </div>
              {isExpanded && (
                <div className={styles.fieldList}>
                  {msg.fields.map((field) => {
                    const isMessageType = messageNames.has(field.field_type);
                    const isPrimitive = PRIMITIVE_TYPES.has(field.field_type);
                    return (
                      <div key={field.number} className={styles.fieldRow}>
                        <span className={styles.fieldNumber}>{field.number}</span>
                        <span className={styles.fieldName}>{field.name}</span>
                        <span
                          className={`${styles.fieldType} ${isMessageType ? styles.fieldTypeMessage : ''}`}
                          onClick={isMessageType ? () => jumpToMessage(field.field_type) : undefined}
                          title={isMessageType ? `Jump to ${field.field_type}` : undefined}
                        >
                          {isPrimitive ? field.field_type : shortName(field.field_type)}
                        </span>
                        {field.is_repeated && (
                          <span className={styles.fieldBadge}>repeated</span>
                        )}
                        {field.is_map && (
                          <span className={`${styles.fieldBadge} ${styles.fieldBadgeMap}`}>map</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function generateTemplate(fields: api.ProtoField[]): string {
  const obj: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.is_repeated) {
      obj[field.name] = [];
    } else if (field.is_map) {
      obj[field.name] = {};
    } else {
      switch (field.field_type) {
        case 'string':
          obj[field.name] = '';
          break;
        case 'bool':
          obj[field.name] = false;
          break;
        case 'int32':
        case 'int64':
        case 'uint32':
        case 'uint64':
        case 'sint32':
        case 'sint64':
        case 'fixed32':
        case 'fixed64':
        case 'sfixed32':
        case 'sfixed64':
        case 'double':
        case 'float':
          obj[field.name] = 0;
          break;
        case 'bytes':
          obj[field.name] = '';
          break;
        default:
          obj[field.name] = {};
      }
    }
  }
  return JSON.stringify(obj, null, 2);
}
