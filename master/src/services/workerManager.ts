// keeps workers list and heartbeats

import { WorkerInfo, WorkerId } from "../models/types";
import { log } from "../utils/logger";
import { nowMs } from "../utils/time";
import { HEARTBEAT_WINDOW_MS } from "../config/constants";

/**
 * WorkerManager
 *
 * Purpose:
 * - Tracks all workers connected to the Master Node.
 * - Maintains real-time cluster state using heartbeats.
 *
 * Key Responsibilities:
 * 1. upsertHeartbeat(payload):
 *    - Insert or update a worker's info when a heartbeat is received.
 *    - Updates fields like freeBytes, totalBytes, metadata, and lastHeartbeat timestamp.
 *
 * 2. getAllWorkers():
 *    - Returns all workers regardless of liveness.
 *
 * 3. getWorker(id):
 *    - Fetch a specific worker by ID.
 *
 * 4. getAliveWorkers():
 *    - Returns only workers that sent a heartbeat within HEARTBEAT_WINDOW_MS.
 *    - Used to ensure tasks are assigned only to active workers.
 *
 * 5. removeWorker(id):
 *    - Manually remove a worker from the registry.
 *
 * Why heartbeat upsert matters:
 * - Without it, Master cannot track worker availability or free space.
 * - Critical for replication, load balancing, and fault tolerance.
 */

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
      (w) => w.lastHeartbeat >= cutoff
    );
  };

  const removeWorker = (id: WorkerId) => {
    workers.delete(id);
  };

  /*
The function below is not necessary in initial phase, it can be used later on 
It Removes the inactive workers

   const cleanupStaleOlderThan = (ms: number) => {
     const cutoff = nowMs() - ms;
     for (const [id, w] of workers.entries()) {
       if (w.lastHeartbeat < cutoff) {
         workers.delete(id);
         log("Removed stale worker:", id);
       }
     }
   };
*/

  return {
    upsertHeartbeat,
    getAllWorkers,
    getWorker,
    getAliveWorkers,
    removeWorker
  };
}
export const workerManager = createWorkerManager();
