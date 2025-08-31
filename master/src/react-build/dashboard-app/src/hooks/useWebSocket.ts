// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from "react";
import type { WsMessage } from "../types/cluster";

type Status = "connecting" | "open" | "closed";

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const pingTimer = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>("connecting");
  const [data, setData] = useState<WsMessage | null>(null);

  const connect = useCallback(() => {
    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setStatus("open");
      // subscribe dashboard updates
      ws.send(JSON.stringify({ type: "dashboard:subscribe" }));
      // start ping every 25s (optional)
      pingTimer.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "ping" }));
      }, 25_000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WsMessage = JSON.parse(ev.data);
        // ignore pongs
        if (msg.type === "pong") return;
        setData(msg);
      } catch (e) {
        console.error("Invalid WS message", e);
      }
    };

    ws.onclose = () => {
      setStatus("closed");
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
      // reconnect with exponential backoff
      const wait = Math.min(30000, 1000 * 2 ** retryRef.current);
      retryRef.current++;
      setTimeout(connect, wait);
    };

    ws.onerror = () => {
      // close to trigger reconnect logic in onclose
      try {
        ws.close();
      } catch (error) {
        console.error(error);
      }
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
      try {
        wsRef.current?.close();
      } catch (error) {
        console.error(error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { data, status, send };
}
