// src/ws/wsServer.ts
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import { WS_PATH } from "../config/constants";
import { workerManager } from "../services/workerManager";
import { log, warn } from "../utils/logger";
import { nowMs } from "../utils/time";
import { mappingStore } from "../services/mappingStore";
import { clusterStats } from "../services/clusterStats";
import axios from "axios";
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

      //storing previous state to compare
      const prev = workerManager.getWorker(id);

      // Update worker heartbeat entry
      workerManager.upsertHeartbeat({
        id,
        host,
        freeBytes,
        totalBytes,
        metadata,
        status: "alive",
      });

      // If this worker was previously dead -> wipe its storage
      if (prev && prev.status === "dead") {
        log(`[ws] Worker ${id} reconnected, sending reset...`);
        try {
          const url = `${host.replace(/\/+$/, "")}/reset`;
          await axios.post(url, {}, { timeout: 10000 });
          log(`[ws] Reset request sent to worker ${id} (${host})`);
          mappingStore.removeWorker(id);
        } catch (err) {
          warn(`[ws] Failed to reset worker ${id}:`, err);
        }
      }

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
          await handleDeadWorkers(newlyDead); // async re-replication
        } catch (err) {
          warn("Re-replication failed:", err);
        }
      }

      // here master sends current stats to dashboard after evry heartbeat cycle
      // also record aggregated cluster usage sample for history
      try {
        const ws = workerManager.getAllWorkers();
        // aggregate logical/physical bytes across workers
        const logical = ws.reduce(
          (acc, w) => acc + (w.totalBytes ?? 0) - w.freeBytes,
          0
        );
        const physical = ws.reduce((acc, w) => acc + (w.totalBytes ?? 0), 0);
        clusterStats.addSample({
          t: Date.now(),
          logical: Math.max(0, logical),
          physical: Math.max(0, physical),
        });
      } catch (e) {
        warn("failed to record clusterStats sample", e);
      }

      broadcastToDashboards({
        type: "cluster:update",
        data: {
          workers: workerManager.getAllWorkers(),
          files: mappingStore.listFiles(),
        },
      });
    } else if (type === "dashboard:subscribe") {
      //here dashboard ask for stats on connection establishment
      client.type = "dashboard";
      client.ws.send(
        JSON.stringify({
          type: "cluster:snapshot",
          data: {
            workers: workerManager.getAllWorkers(),
            files: mappingStore.listFiles(),
            // include recent history (~ last 10 minutes)
            history: clusterStats.getRecent(10 * 60 * 1000),
          },
        })
      );
    } else {
      warn("Unknown WS message type:", type);
    }
  }
}
