import { WorkerInfo, WorkerId } from "../models/types";
import { log } from "../utils/logger";
import { nowMs } from "../utils/time";
import { HEARTBEAT_WINDOW_MS } from "../config/constants";

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
    log("Heartbeat upsert:", id, `freeBytes=${w.freeBytes}`);
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

  const markDeadIfExpired = (): boolean => {
    const cutoff = nowMs() - HEARTBEAT_WINDOW_MS;
    let changed = false;
    for (const w of workers.values()) {
      if (w.status === "alive" && w.lastHeartbeat < cutoff) {
        w.status = "dead";
        changed = true;
        log("Marked worker as dead:", w.id);
      }
    }
    return changed;
  };

  const removeWorker = (id: WorkerId) => {
    workers.delete(id);
  };

  return {
    upsertHeartbeat,
    getAllWorkers,
    getWorker,
    getAliveWorkers,
    markDeadIfExpired,
    removeWorker,
  };
}

export const workerManager = createWorkerManager();
