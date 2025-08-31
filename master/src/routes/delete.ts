// src/routes/delete.ts
import express from "express";
import axios from "axios";
import { mappingStore } from "../services/mappingStore";
import { workerManager } from "../services/workerManager";
import { FilePlan } from "../models/types";
import { log, warn, error } from "../utils/logger";

const router = express.Router();

/** Ensure host includes protocol */
function normalizeHost(host: string): string {
  return host.startsWith("http") ? host : `http://${host}`;
}

/** Delete a single chunk on a single worker */
async function deleteChunkOnWorker(workerHost: string, chunkId: string) {
  const url = `${workerHost.replace(
    /\/+$/,
    ""
  )}/deleteChunk/${encodeURIComponent(chunkId)}`;
  try {
    const res = await axios.delete(url, { timeout: 10000 });
    if (res.status >= 200 && res.status < 300) return { ok: true };
    return { ok: false, error: `Unexpected status ${res.status}` };
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { ok: true }; // already gone → idempotent
    }
    return { ok: false, error: err.message || String(err) };
  }
}

/** Attempt to delete all chunks on all *online* workers */
async function deleteFileChunks(plan: FilePlan) {
  const results: {
    workerId: string;
    chunkId: string;
    ok: boolean;
    error?: string;
  }[] = [];

  for (const chunk of plan.chunks) {
    for (const workerId of chunk.workers) {
      const worker = workerManager.getWorker(workerId);
      const chunkId = chunk.id;

      if (!worker || worker.status == "dead") {
        // skip disconnected workers
        warn(`[delete] Worker ${workerId} offline, skipping chunk ${chunkId}`);
        continue;
      }

      const host = normalizeHost(worker.host);
      log(`[delete] Deleting chunk ${chunkId} on worker ${workerId}`);
      const result = await deleteChunkOnWorker(host, chunkId);

      results.push({ workerId, chunkId, ...result });

      if (result.ok)
        log(`[delete] Deleted chunk ${chunkId} on worker ${workerId}`);
      else
        warn(
          `[delete] Failed deleting chunk ${chunkId} on worker ${workerId}: ${result.error}`
        );
    }
  }

  return results;
}

/** DELETE /delete/:filename endpoint */
router.delete("/delete/:filename", async (req, res) => {
  const { filename } = req.params;
  if (!filename) return res.status(400).json({ error: "filename required" });

  const plan = mappingStore.getFilePlan(filename);
  if (!plan) return res.status(404).json({ error: "file not found" });

  plan.status = "deleting";
  mappingStore.saveFilePlan(plan);

  try {
    await deleteFileChunks(plan);

    // Always remove mapping regardless of worker status
    mappingStore.removeFilePlan?.(filename);
    log(`[delete] File ${filename} fully removed (mapping + chunks if online)`);

    return res.json({
      success: true,
      message:
        "File deleted. Chunks removed from online workers; offline workers will be wiped on reconnect.",
    });
  } catch (err: any) {
    error(`[delete] Unexpected error deleting ${filename}:`, err);
    return res
      .status(500)
      .json({ error: "delete failed", details: err.message || String(err) });
  }
});

export default router;
