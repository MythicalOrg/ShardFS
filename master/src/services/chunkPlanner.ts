// decide Chunks size + choose workers

// core logic: dynamic chunking + load-aware worker placement + round-robin seed
// chooseWorkersForChunk returns WorkerId[] for replication

import { MB, DEFAULT_RF } from "../config/constants";
import { workerManager } from "./workerManager";
import { FilePlan, ChunkPlan } from "../models/types";
import { mappingStore } from "./mappingStore";
import { v4 as uuidv4 } from "uuid";

const MIN_CHUNK_SIZE = 16 * MB;
const MAX_CHUNK_SIZE = 64 * MB;

/**
 * Dynamically determine chunk size based on file size and worker count.
 * Target: ~2 chunks per worker, within min/max bounds.
 */
export const decideChunkSize = (
  fileSizeBytes: number,
  workerCount: number
): number => {
  const desiredChunks = Math.min(100, Math.max(1, Math.floor(workerCount * 2))); // target ~2 chunks per worker
  const size = fileSizeBytes / desiredChunks;
  return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, size));
};

/**
 * Choose workers for a chunk using a hybrid strategy:
 * - Space-aware: prefer workers with more free space.
 * - Round-robin: rotate start index to avoid hotspotting same workers over time.
 * - Deducts chunk size from a local copy to balance assignments within the same file.
 */

let roundRobinCounter = 0;

export function chooseWorkersForChunk(
  chunkSize: number,
  replicationFactor = DEFAULT_RF
): string[] {
  // Get all alive workers that can hold the chunk
  const aliveWorkers = workerManager
    .getAliveWorkers()
    .filter((w) => w.freeBytes >= chunkSize);
  if (aliveWorkers.length === 0) return [];

  // Make a local copy for planning
  const workerPool = aliveWorkers.map((w) => ({ ...w }));

  // Sort descending by freeBytes (space-aware)
  workerPool.sort((a, b) => b.freeBytes - a.freeBytes);

  // Start index rotates using round-robin
  const startIdx = roundRobinCounter % workerPool.length;
  roundRobinCounter++;

  const chosen: string[] = [];
  let i = 0;

  // Pick replicationFactor workers using round-robin over the sorted list
  while (chosen.length < replicationFactor && i < workerPool.length) {
    const idx = (startIdx + i) % workerPool.length;
    const worker = workerPool[idx];

    if (!chosen.includes(worker.id)) {
      chosen.push(worker.id);
      // Deduct allocated space in local pool to prevent overload for next chunks
      worker.freeBytes -= chunkSize;
    }

    i++;
  }

  return chosen;
}

/**
 * Optimized file planning:
 * - Dynamic chunk size based on worker pool size
 * - Load-aware worker selection for each chunk
 * - Deducts allocated space to balance future chunks
 */

export function planFileChunks(
  filename: string,
  sizeBytes: number,
  replicationFactor = DEFAULT_RF
): FilePlan {
  const aliveWorkers = workerManager.getAliveWorkers();
  if (aliveWorkers.length === 0) throw new Error("No alive workers available");

  const chunkSize = decideChunkSize(sizeBytes, aliveWorkers.length);
  const numChunks = Math.ceil(sizeBytes / chunkSize);

  // Create mutable copy for planning
  const workerPool = aliveWorkers.map((w) => ({ ...w }));

  const chunks: ChunkPlan[] = [];
  for (let i = 0; i < numChunks; i++) {
    const id = `${filename}_part${i}_${uuidv4().slice(0, 8)}`;
    const thisChunkSize =
      i === numChunks - 1 ? sizeBytes - i * chunkSize : chunkSize;

    // Sort workers by available freeBytes
    workerPool.sort((a, b) => b.freeBytes - a.freeBytes);
    const chosen = workerPool.slice(0, replicationFactor).map((w) => w.id);

    if (chosen.length < replicationFactor) {
      throw new Error(
        `Insufficient workers for replication: needed ${replicationFactor}, got ${chosen.length}`
      );
    }

    // Deduct used space
    chosen.forEach((id) => {
      const w = workerPool.find((x) => x.id === id);
      if (w) w.freeBytes -= thisChunkSize;
    });

    chunks.push({ id, size: thisChunkSize, workers: chosen, index: i });
  }

  const plan: FilePlan = {
    filename,
    size: sizeBytes,
    chunkSize,
    chunks,
    createdAt: Date.now(),
  };
  mappingStore.saveFilePlan(plan);
  return plan;
}
