// src/hooks/useWebSocket.ts
import { useEffect, useState } from "react";
import type { WsMessage } from "../types/cluster";

export function useWebSocket(url: string) {
  const [data, setData] = useState<WsMessage | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">(
    "connecting"
  );

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("open");
      ws.send(JSON.stringify({ type: "dashboard:subscribe" }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        setData(msg);
      } catch (err) {
        console.error("Invalid WS message", err);
      }
    };

    ws.onclose = () => setStatus("closed");

    return () => ws.close();
  }, [url]);

  return { data, status };
}
