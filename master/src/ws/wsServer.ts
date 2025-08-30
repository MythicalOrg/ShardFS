// src/ws/wsServer.ts
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import { WS_PATH } from "../config/constants";
import { workerManager } from "../services/workerManager";
import { log, warn } from "../utils/logger";
import { nowMs } from "../utils/time";
import { mappingStore } from "../services/mappingStore";
import { handleDeadWorkers } from "../services/reReplication";

// The "unknown" type refers to the initial state of any new WebSocket connection
// before it identifies itself as either:
//   - A worker node (when it sends type: "worker:heartbeat" message)
//   - A dashboard client (when it sends type: "dashboard:subscribe" message)

type ClientType = "worker" | "dashboard" | "unknown";

interface ConnectedClient {
  ws: WebSocket;
  type: ClientType;
  id?: string;
  connectedAt: number;
}

export function attachWebsocket(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  const clients = new Set<ConnectedClient>();

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (!url.startsWith(WS_PATH)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const c: ConnectedClient = { ws, type: "unknown", connectedAt: nowMs() };
    clients.add(c);

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        handleMessage(c, parsed);
      } catch (err) {
        warn("Invalid WS message", err);
      }
    });

    ws.on("close", () => {
      clients.delete(c);
    });

    ws.on("error", (e) => {
      warn("WS error", e);
    });

    // send initial summary (to anyone, even if they later identify as dashboard)
    ws.send(
      JSON.stringify({
        type: "master:info",
        data: { time: Date.now(), files: mappingStore.listFiles().length },
      })
    );
  });

  function broadcastToDashboards(payload: any) {
    for (const c of clients) {
      if (c.type === "dashboard") {
        try {
          c.ws.send(JSON.stringify(payload));
        } catch (err) {
          warn("failed to send to dashboard", err);
        }
      }
    }
  }

  async function handleMessage(client: ConnectedClient, msg: any) {
    const { type, data } = msg;

    if (type === "worker:heartbeat") {
      const { id, host, freeBytes, totalBytes, metadata } = data;
      client.type = "worker";
      client.id = id;

      // Update worker heartbeat entry
      workerManager.upsertHeartbeat({
        id,
        host,
        freeBytes,
        totalBytes,
        metadata,
        status: "alive",
      });

      // Check for newly dead workers (by heartbeat expiry)
      const newlyDead = workerManager.markDeadIfExpired();

      if (newlyDead.length > 0) {
        broadcastToDashboards({
          type: "cluster:update",
          data: {
            workers: workerManager.getAllWorkers(),
            files: mappingStore.listFiles(),
          },
        });

        try {
          await handleDeadWorkers(newlyDead);
          // correct now: newlyDead is string[]
        } catch (err) {
          warn("Re-replication failed:", err);
        }
      }

      // broadcast latest state to dashboards
      broadcastToDashboards({
        type: "cluster:update",
        data: {
          workers: workerManager.getAllWorkers(),
          files: mappingStore.listFiles(),
        },
      });
    } else if (type === "dashboard:subscribe") {
      client.type = "dashboard";
      client.ws.send(
        JSON.stringify({
          type: "cluster:snapshot",
          data: {
            workers: workerManager.getAllWorkers(),
            files: mappingStore.listFiles(),
          },
        })
      );
    } else if (type === "get:workers") {
      client.ws.send(
        JSON.stringify({
          type: "workers:list",
          data: workerManager.getAllWorkers(),
        })
      );
    } else {
      warn("Unknown WS message type:", type);
    }
  }
}
