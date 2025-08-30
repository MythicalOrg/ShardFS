// worker/routes/reReplicate.ts
import { Request, Response } from "express";
import axios from "axios";
import { log, error } from "../utils/logger";
import { storage } from "../services/storage";

interface ReReplicateRequest {
  chunkId: string;        // single chunkId
  targets: string[];      // list of target worker URLs
}

interface ReplicationResult {
  target: string;
  status: "success" | "failed";
  error?: string;
}

export function setupReReplicateRouteV2(app: any): void {
  app.post("/rereplicate", async (req: Request, res: Response) => {
    try {
      const { chunkId, targets }: ReReplicateRequest = req.body;

      if (!chunkId || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: "chunkId and non-empty targets[] are required" });
      }

      // check if chunk exists locally
      if (!storage.hasChunk(chunkId)) {
        log(`❌ Chunk ${chunkId} not found locally`);
        return res.status(404).json({ error: `chunk ${chunkId} not found locally` });
      }

      const chunkInfo = storage.getChunkInfo(chunkId);
      const chunkData = await storage.getChunk(chunkId);

      if (!chunkInfo || !chunkData) {
        error(`❌ Failed to read chunk ${chunkId} from storage`);
        return res.status(500).json({ error: `Failed to read chunk ${chunkId}` });
      }

      log(`♻️ Re-replication request for ${chunkId} → ${targets.join(", ")}`);

      // replicate to all targets in parallel
      const results: ReplicationResult[] = await Promise.all(
        targets.map(async (target) => {
          try {
            const uploadUrl = `${target}/uploadChunk`;

            const response = await axios.post(uploadUrl, chunkData, {
              headers: {
                "Content-Type": "application/octet-stream",
                "x-chunk-id": chunkId,
                "x-filename": chunkInfo.filename,
                "x-chunk-index": String(chunkInfo.index),
                "x-chunk-size": String(chunkData.length),
                "x-total-size": String(chunkInfo.size),
              },
              timeout: 60_000,
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            });

            if (response.status === 200) {
              log(`✅ Successfully replicated ${chunkId} → ${target}`);
              return { target, status: "success" as const };
            } else {
              error(`❌ Replication to ${target} failed: HTTP ${response.status}`);
              return { target, status: "failed" as const, error: `HTTP ${response.status}` };
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            error(`❌ Error replicating ${chunkId} → ${target}: ${msg}`);
            return { target, status: "failed" as const, error: msg };
          }
        })
      );

      // build response
      res.json({
        chunkId,
        replicated: results.filter(r => r.status === "success"),
        failed: results.filter(r => r.status === "failed"),
        summary: {
          totalTargets: targets.length,
          success: results.filter(r => r.status === "success").length,
          failed: results.filter(r => r.status === "failed").length,
        },
      });

    } catch (err) {
      error("Re-replication route error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
