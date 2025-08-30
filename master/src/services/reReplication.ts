// src/services/reReplication.ts
import axios from "axios";
import { mappingStore } from "./mappingStore";
import { workerManager } from "./workerManager";
import { DEFAULT_RF, REPLICATION_CANDIDATE_LIMIT } from "../config/constants";
import { log, warn, error } from "../utils/logger";
import { FilePlan } from "../models/types";

/**
 * reReplicationService
 * - handleDeadWorkers(deadWorkerIds: string[])
 *
 * Flow per dead worker:
 * 1. For each file plan in mappingStore:
 *    - For each chunk: if dead worker id is present in chunk.workers:
 *        -> compute aliveReplicas = chunk.workers.filter(isAlive)
 *        -> needed = REPLICATION_FACTOR - aliveReplicas.length
 *        -> if needed <= 0 -> nothing to do
 *        -> pick a source = first alive replica (or skip if none)
 *        -> pick target workers: top alive workers that don't already have the chunk (based on workerId),
 *           up to 'needed' count (we keep candidate limit)
 *        -> call sourceHost + "/rereplicate" with { chunkId, targets: [targetUrls] }
 *        -> on success: update chunk.workers to include newly-replicated workerIds (NOTE: we update only
 *           after verifying success response contains list of replicated targets)
 *
 * Notes:
 * - sourceHost is derived from workerManager.getWorker(sourceId).host
 * - target 'URL' used by worker routes should include protocol (normalize it)
 */

// Ensure host includes protocol
function normalizeHost(host: string): string {
  return host.startsWith("http") ? host : `http://${host}`;
}

function isWorkerAlive(workerId: string): boolean {
  const w = workerManager.getWorker(workerId);
  return !!w && w.status === "alive";
}

async function sendReReplicateRequest(
  sourceHost: string,
  chunkId: string,
  targetUrls: string[]
): Promise<{ ok: boolean; response?: any; error?: string }> {
  const url = `${sourceHost.replace(/\/+$/, "")}/rereplicate`;
  try {
    const res = await axios.post(
      url,
      { chunkId, targets: targetUrls },
      { timeout: 60_000 } // 60s
    );
    return { ok: true, response: res.data };
  } catch (err: any) {
    const msg = axios.isAxiosError(err) ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function handleDeadWorkers(deadWorkerIds: string[]) {
  if (!deadWorkerIds || deadWorkerIds.length === 0) return;

  log(`[reReplication] Detected dead workers: ${deadWorkerIds.join(", ")}`);

  const filePlans: FilePlan[] = mappingStore.listFiles();

  for (const plan of filePlans) {
    let planModified = false;

    for (const chunk of plan.chunks) {
      // If this chunk was hosted on any of the dead workers
      const hadDead = chunk.workers.some((w) => deadWorkerIds.includes(w));
      if (!hadDead) continue;

      const aliveReplicas = chunk.workers.filter(isWorkerAlive);
      const aliveCount = aliveReplicas.length;
      const needed = Math.max(0, DEFAULT_RF - aliveCount);

      log(
        `[reReplication] file=${plan.filename} chunk=${chunk.id} alive=${aliveCount} needed=${needed}`
      );

      if (needed <= 0) {
        // ✅ Do NOT delete dead worker mappings anymore
        // Just log the current state
        log(
          `[reReplication] Replication factor already satisfied for chunk ${chunk.id}. Keeping dead worker IDs in mapping.`
        );
        continue;
      }

      // pick a source replica (first alive replica)
      if (aliveReplicas.length === 0) {
        warn(
          `[reReplication] No alive replicas available for chunk ${chunk.id} (file=${plan.filename}). Manual intervention needed.`
        );
        continue;
      }

      const sourceWorkerId = aliveReplicas[0];
      const sourceWorker = workerManager.getWorker(sourceWorkerId);
      if (!sourceWorker) continue;
      const sourceHost = normalizeHost(sourceWorker.host);

      // choose candidate targets
      const allAlive = workerManager
        .getAllWorkers()
        .filter((w) => w.status === "alive");

      const candidates = allAlive
        .filter((w) => w.id !== sourceWorkerId && !chunk.workers.includes(w.id))
        .sort((a, b) => (b.freeBytes ?? 0) - (a.freeBytes ?? 0))
        .slice(0, REPLICATION_CANDIDATE_LIMIT);

      if (candidates.length === 0) continue;

      const chosenTargets = candidates.slice(0, needed);
      const targetUrls = chosenTargets.map((w) => normalizeHost(w.host));

      log(
        `[reReplication] Replicating chunk=${
          chunk.id
        } from ${sourceWorkerId} → ${chosenTargets.map((c) => c.id).join(", ")}`
      );

      const {
        ok,
        response,
        error: sendErr,
      } = await sendReReplicateRequest(sourceHost, chunk.id, targetUrls);

      if (!ok) {
        error(
          `[reReplication] Failed to request re-replication for chunk ${chunk.id}: ${sendErr}`
        );
        continue;
      }

      // Add new workers to mapping (without removing dead ones)
      const replicatedTargets: string[] = Array.isArray(response?.replicated)
        ? response.replicated.map((r: any) => r.target)
        : [];

      for (const tUrl of replicatedTargets) {
        const normalized = tUrl.replace(/\/+$/, "");
        const matched = workerManager
          .getAllWorkers()
          .find(
            (w) => normalizeHost(w.host).replace(/\/+$/, "") === normalized
          );

        if (matched && !chunk.workers.includes(matched.id)) {
          chunk.workers.push(matched.id); // ✅ Append only
          planModified = true;
          log(
            `[reReplication] chunk ${chunk.id} now replicated to worker ${matched.id}`
          );
        }
      }
    }

    // ✅ After processing a file plan, log workers with statuses
    if (planModified) {
      log(`[reReplication] Updated mapping for file=${plan.filename}`);
      for (const chunk of plan.chunks) {
        const mappingStr = chunk.workers
          .map((wid) => {
            const w = workerManager.getWorker(wid);
            return w ? `${wid}(${w.status})` : `${wid}(unknown/dead)`; // fallback if worker not in registry
          })
          .join(", ");
        log(`  chunk=${chunk.id} → [${mappingStr}]`);
      }
    }
  }
}
