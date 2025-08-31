// decide Chunks size + choose workers

import { MB, DEFAULT_RF } from "../config/constants";
import { workerManager } from "./workerManager";
import { FilePlan, ChunkPlan } from "../models/types";
import { mappingStore } from "./mappingStore";

const MIN_CHUNK_SIZE = 1024 * 256; // 256 KB
const MAX_CHUNK_SIZE = 1024 * 1024 * 64; // 64 MB

export const decideChunkSize = (fileSizeBytes: number): number => {
  if (fileSizeBytes <= MIN_CHUNK_SIZE) {
    return MIN_CHUNK_SIZE;
  }

  // Start with number of chunks if we capped at MAX
  const chunks = Math.ceil(fileSizeBytes / MAX_CHUNK_SIZE);

  // evenly distributing chunks
  return Math.min(
    MAX_CHUNK_SIZE,
    Math.ceil(fileSizeBytes / chunks)
  );
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
  workerMap: Map<string, { id: string; freeBytes: number }>,
  replicationFactor = DEFAULT_RF
): string[] {
  const sortedWorkers = Array.from(workerMap.values()).sort(
    (a, b) => b.freeBytes - a.freeBytes
  );
  if (sortedWorkers.length === 0) return [];

  const startIdx = roundRobinCounter % sortedWorkers.length;
  roundRobinCounter++;

  const chosen: string[] = [];
  let i = 0;

  while (chosen.length < replicationFactor && i < sortedWorkers.length) {
    const idx = (startIdx + i) % sortedWorkers.length;
    const worker = sortedWorkers[idx];

    if (!chosen.includes(worker.id)) {
      chosen.push(worker.id);

      // Deduct allocated space in the Map (O(1) lookup)
      const wInMap = workerMap.get(worker.id);
      if (wInMap) wInMap.freeBytes -= chunkSize;
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

  const chunkSize = decideChunkSize(sizeBytes);
  const numChunks = Math.ceil(sizeBytes / chunkSize);

  // Use Map for fast lookup and freeBytes tracking
  const workerMap = new Map(
    aliveWorkers.map((w) => [w.id, { id: w.id, freeBytes: w.freeBytes }])
  );

  const chunks: ChunkPlan[] = [];

  for (let i = 0; i < numChunks; i++) {
    const id = `${filename}_part${i}`;
    const thisChunkSize =
      i === numChunks - 1 ? sizeBytes - i * chunkSize : chunkSize;

    const chosenWorkers = chooseWorkersForChunk(
      thisChunkSize,
      workerMap,
      replicationFactor
    );

    if (chosenWorkers.length < replicationFactor) {
      throw new Error(
        `Insufficient workers for replication: needed ${replicationFactor}, got ${chosenWorkers.length}`
      );
    }

    chunks.push({
      id,
      size: thisChunkSize,
      workers: chosenWorkers,
      index: i,
    });
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
