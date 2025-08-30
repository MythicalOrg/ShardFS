import { WorkerInfo, WorkerId } from "../models/types";
import { HEARTBEAT_WINDOW_MS } from "../config/constants";
import { log, warn } from "../utils/logger";
import { nowMs } from "../utils/time";


export function createWorkerManager() {
  const workers: Map<WorkerId, WorkerInfo> = new Map();

  const upsertHeartbeat = (
    payload: Omit<WorkerInfo, "lastHeartbeat"> &
      Partial<Pick<WorkerInfo, "totalBytes" | "metadata">>
  ): WorkerInfo => {
    const id = payload.id;
    const w: WorkerInfo = {
      id,
      host: payload.host,
      freeBytes: payload.freeBytes,
      totalBytes: payload.totalBytes,
      metadata: payload.metadata || {},
      lastHeartbeat: nowMs(),
      status: "alive", // always alive on heartbeat
    };
    workers.set(id, w);
    log("[workerManager] Heartbeat upsert:", id, `freeBytes=${w.freeBytes}`);
    return w;
  };

  const getAllWorkers = (): WorkerInfo[] => Array.from(workers.values());

  const getWorker = (id: WorkerId): WorkerInfo | undefined => workers.get(id);

  const getAliveWorkers = (): WorkerInfo[] => {
    const cutoff = nowMs() - HEARTBEAT_WINDOW_MS;
    return Array.from(workers.values()).filter(
      (w) => w.lastHeartbeat >= cutoff && w.status === "alive"
    );
  };

  const markDeadIfExpired = (): WorkerId[] => {
    const cutoff = nowMs() - HEARTBEAT_WINDOW_MS;
    const newlyDead: WorkerId[] = [];

    for (const w of workers.values()) {
      if (w.status === "alive" && w.lastHeartbeat < cutoff) {
        w.status = "dead";
        newlyDead.push(w.id);
        log("Marked worker as dead:", w.id);
      }
    }

    return newlyDead;
  };

  const markAlive = (id: WorkerId) => {
    const w = workers.get(id);
    if (w) {
      w.status = "alive";
      w.lastHeartbeat = nowMs();
      workers.set(id, w);
      log(`[workerManager] Worker marked alive again: ${id}`);
    }
  };

  const removeWorker = (id: WorkerId) => {
    workers.delete(id);
    log(`[workerManager] Removed worker: ${id}`);
  };

  return {
    upsertHeartbeat,
    getAllWorkers,
    getWorker,
    getAliveWorkers,
    markDeadIfExpired,
    markAlive, // ✅ new addition
    removeWorker,
  };
}

export const workerManager = createWorkerManager();
