import { useState, useRef, useEffect, useCallback } from 'react';
import { Plug, Unplug, Send, Trash2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { Input } from '../../common/Input/Input';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/IconButton/IconButton';
import * as api from '../../../utils/api';
import styles from './WebSocketPanel.module.css';

interface WsMessage {
  direction: string;
  data: string;
  timestamp: string;
  message_type: string;
}

const WS_ID = 'main';

export function WebSocketPanel() {
  const [url, setUrl] = useState('wss://');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for incoming WebSocket messages
  useEffect(() => {
    const unlistenMsg = listen<WsMessage>(`ws-message-${WS_ID}`, (event) => {
      setMessages((prev) => [...prev, event.payload]);
    });

    const unlistenDisconnect = listen<string>(`ws-disconnected-${WS_ID}`, (event) => {
      setConnected(false);
      setMessages((prev) => [
        ...prev,
        {
          direction: 'system',
          data: `Disconnected: ${event.payload}`,
          timestamp: new Date().toISOString(),
          message_type: 'close',
        },
      ]);
    });

    return () => {
      unlistenMsg.then((fn) => fn());
      unlistenDisconnect.then((fn) => fn());
    };
  }, []);

  const handleConnect = useCallback(async () => {
    if (!url.trim()) return;
    setConnecting(true);
    try {
      await api.wsConnect(WS_ID, url);
      setConnected(true);
      setMessages((prev) => [
        ...prev,
        {
          direction: 'system',
          data: `Connected to ${url}`,
          timestamp: new Date().toISOString(),
          message_type: 'text',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          direction: 'system',
          data: `Connection failed: ${err}`,
          timestamp: new Date().toISOString(),
          message_type: 'close',
        },
      ]);
    } finally {
      setConnecting(false);
    }
  }, [url]);

  const handleDisconnect = useCallback(async () => {
    try {
      await api.wsDisconnect(WS_ID);
    } catch { /* ignore */ }
    setConnected(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !connected) return;
    try {
      await api.wsSend(WS_ID, message);
      setMessages((prev) => [
        ...prev,
        {
          direction: 'sent',
          data: message,
          timestamp: new Date().toISOString(),
          message_type: 'text',
        },
      ]);
      setMessage('');
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          direction: 'system',
          data: `Send failed: ${err}`,
          timestamp: new Date().toISOString(),
          message_type: 'text',
        },
      ]);
    }
  }, [message, connected]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  return (
    <div className={styles.container}>
      {/* Connection Bar */}
      <div className={styles.connectionBar}>
        <div className={`${styles.statusDot} ${connected ? styles.statusConnected : ''}`} />
        <Input
          className={styles.urlInput}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !connected && handleConnect()}
          placeholder="wss://echo.websocket.org"
          mono
          disabled={connected}
        />
        {connected ? (
          <Button variant="secondary" onClick={handleDisconnect}>
            <Unplug size={14} />
            <span>DISCONNECT</span>
          </Button>
        ) : (
          <Button variant="primary" onClick={handleConnect} disabled={connecting}>
            <Plug size={14} />
            <span>{connecting ? '...' : 'CONNECT'}</span>
          </Button>
        )}
      </div>

      {/* Message Log */}
      <div className={styles.log} ref={logRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyLog}>
            Connect to a WebSocket server to start sending and receiving messages.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${
                msg.direction === 'sent'
                  ? styles.messageSent
                  : msg.direction === 'received'
                    ? styles.messageReceived
                    : styles.messageSystem
              }`}
            >
              <div className={styles.messageHeader}>
                <span className={styles.messageDirection}>
                  {msg.direction === 'sent' ? '>' : msg.direction === 'received' ? '<' : '#'}
                </span>
                <span className={styles.messageTime}>{formatTime(msg.timestamp)}</span>
              </div>
              <div className={styles.messageData}>{msg.data}</div>
            </div>
          ))
        )}
      </div>

      {/* Message Composer */}
      <div className={styles.composer}>
        <div className={styles.composerActions}>
          <IconButton
            onClick={() => setMessages([])}
            title="Clear log"
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
        <Input
          className={styles.messageInput}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={connected ? 'Type a message...' : 'Connect first...'}
          disabled={!connected}
          mono
        />
        <IconButton
          onClick={handleSend}
          title="Send message"
        >
          <Send size={14} />
        </IconButton>
      </div>
    </div>
  );
}
