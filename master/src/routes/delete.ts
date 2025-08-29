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
    const res = await axios.delete(url, { timeout: 5000 });
    if (res.status >= 200 && res.status < 300)
      return { ok: true, status: res.status };
    return {
      ok: false,
      status: res.status,
      error: `Unexpected status ${res.status}`,
    };
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404)
      return { ok: true, status: 404 }; // idempotent
    return { ok: false, error: err.message || String(err) };
  }
}

/** Delete all chunks of a file across all workers */
async function deleteFileChunks(plan: FilePlan) {
  const results: {
    workerId: string;
    workerHost?: string;
    chunkId: string;
    ok: boolean;
    status?: number;
    error?: string;
  }[] = [];

  for (const chunk of plan.chunks) {
    for (const workerId of chunk.workers) {
      const worker = workerManager.getWorker(workerId);
      const chunkId = chunk.id;

      if (!worker) {
        warn(`[delete] Worker not found: ${workerId} for chunk ${chunkId}`);
        results.push({
          workerId,
          chunkId,
          ok: false,
          error: "worker not found",
        });
        continue;
      }

      const host = normalizeHost(worker.host);
      log(`[delete] Deleting chunk ${chunkId} on worker ${workerId} (${host})`);
      const result = await deleteChunkOnWorker(host, chunkId);

      results.push({
        workerId,
        workerHost: host,
        chunkId,
        ok: result.ok,
        status: result.status,
        error: result.error,
      });

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
  if (plan.status === "deleting")
    return res.status(409).json({ error: "file is already being deleted" });
  if (plan.status === "deleted")
    return res.status(410).json({ error: "file already deleted" });

  plan.status = "deleting";
  mappingStore.saveFilePlan(plan);

  try {
    const results = await deleteFileChunks(plan);

    const allSuccess = results.every((r) => r.ok);
    const anySuccess = results.some((r) => r.ok);

    if (allSuccess) {
      plan.status = "deleted";
      mappingStore.saveFilePlan(plan);
      mappingStore.removeFilePlan?.(filename);
      log(`[delete] File ${filename} deleted from all workers`);
      console.log(
        "[DEBUG] Current mappings after deletion:",
        mappingStore.listFiles()
      );
      return res.json({
        success: true,
        message: "File deleted successfully",
        results,
      });
    }

    if (anySuccess) {
      warn(`[delete] Partial delete for ${filename}`);
      plan.status = "active";
      mappingStore.saveFilePlan(plan);
      return res.status(207).json({
        success: false,
        message: "Partial delete: some workers failed",
        results,
      });
    }

    plan.status = "active";
    mappingStore.saveFilePlan(plan);
    error(`[delete] Delete failed for ${filename} on all workers`);
    return res.status(500).json({
      success: false,
      message: "Delete failed on all workers",
      results,
    });
  } catch (err: any) {
    plan.status = "active";
    mappingStore.saveFilePlan(plan);
    error(`[delete] Unexpected error deleting ${filename}:`, err);
    return res
      .status(500)
      .json({ error: "delete failed", details: err.message || String(err) });
  }
});

export default router;
