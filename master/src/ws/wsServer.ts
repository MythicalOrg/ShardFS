import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import { WS_PATH } from "../config/constants";
import { workerManager } from "../services/workerManager";
import { log, warn } from "../utils/logger";
import { nowMs } from "../utils/time";
import { mappingStore } from "../services/mappingStore";

// for now dashboard is just defined, but not used

// The "unknown" type in your code refers to the initial state of any new WebSocket connection before it identifies itself as either:
//      A worker node (when it sends type: "worker:heartbeat" message)
//      A dashboard client (when it sends type: "dashboard:subscribe" message)

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
    // route upgrades to WS_PATH only
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

    // send initial summary when dashboard connects
    ws.send(
      JSON.stringify({
        type: "master:info",
        data: { time: Date.now(), files: mappingStore.listFiles().length },
      })
    );
  });

  //   function broadcastToDashboards(payload: any) {
  //     for (const c of clients) {
  //       if (c.type === "dashboard") {
  //         try {
  //           c.ws.send(JSON.stringify(payload));
  //         } catch (err) {
  //           warn("failed to send to dashboard", err);
  //         }
  //       }
  //     }
  //   }

  function handleMessage(client: ConnectedClient, msg: any) {
    const { type, data } = msg;
    if (type === "worker:heartbeat") {
      // worker heartbeat
      const { id, host, freeBytes, totalBytes } = data;
      client.type = "worker";
      client.id = id;
      const w = workerManager.upsertHeartbeat({
        id,
        host,
        freeBytes,
        totalBytes,
      });
      // broadcast cluster state to dashboards
      //   broadcastToDashboards({
      //     type: "cluster:update",
      //     data: { workers: workerManager.getAllWorkers() },
      //   });
    }
    // else if (type === "dashboard:subscribe") {
    //   client.type = "dashboard";
    //   client.id = undefined;
    //   // reply with current snapshot
    //   client.ws.send(
    //     JSON.stringify({
    //       type: "cluster:snapshot",
    //       data: {
    //         workers: workerManager.getAllWorkers(),
    //         files: mappingStore.listFiles(),
    //       },
    //     })
    //   );
    // }
    else if (type === "get:workers") {
      client.ws.send(
        JSON.stringify({
          type: "workers:list",
          data: workerManager.getAllWorkers(),
        })
      );
    } else {
      // unknown - log
      warn("Unknown WS message type:", type);
    }
  }

  log("WebSocket server attached on path", WS_PATH);
}
