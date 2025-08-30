// Re-Replication Route V1 - Replicates chunks to ALL workers in targetWorkers array using parallel processing
import { Request, Response } from "express";
import axios from "axios";
import { log, error, warn } from "../utils/logger";
import { storage } from "../services/storage";

// Interface for re-replication request
interface ReReplicateRequest {
  chunkIds: string[];
  targetWorkers: string[]; // Array of worker URLs like ["http://worker1:8000", "http://worker2:8000"]
}

// Interface for replication result
interface ReplicationResult {
  chunkId: string;
  targets: string[];
  status: "success" | "failed";
  error?: string;
}

// Interface for response
interface ReReplicateResponse {
  success: boolean;
  replicated: ReplicationResult[];
  failed: ReplicationResult[];
  notFound: string[];
  summary: {
    totalRequested: number;
    totalReplicated: number;
    totalFailed: number;
    totalNotFound: number;
  };
}

// Re-replication route - handles chunk replication to other workers
export function setupReReplicateRoute(app: any): void {
  app.post("/reReplicate", async (req: Request, res: Response) => {
    try {
      const { chunkIds, targetWorkers }: ReReplicateRequest = req.body;

      // Validate request
      if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
        return res.status(400).json({
          error: "chunkIds array is required and must not be empty"
        });
      }

      if (!targetWorkers || !Array.isArray(targetWorkers) || targetWorkers.length === 0) {
        return res.status(400).json({
          error: "targetWorkers array is required and must not be empty"
        });
      }

      log(`Re-replication request: ${chunkIds.length} chunks to ${targetWorkers.length} workers`);

      const replicated: ReplicationResult[] = [];
      const failed: ReplicationResult[] = [];
      const notFound: string[] = [];

      // Process each chunk ID
      for (const chunkId of chunkIds) {
        // Check if we have this chunk locally
        if (!storage.hasChunk(chunkId)) {
          notFound.push(chunkId);
          log(`Chunk ${chunkId} not found locally, skipping`);
          continue;
        }

        // Get chunk info and data
        const chunkInfo = storage.getChunkInfo(chunkId);
        const chunkData = await storage.getChunk(chunkId);

        if (!chunkInfo || !chunkData) {
          failed.push({
            chunkId,
            targets: targetWorkers,
            status: "failed",
            error: "Failed to read chunk data"
          });
          error(`Failed to read chunk ${chunkId} for replication`);
          continue;
        }

        log(`Replicating chunk ${chunkId} (${chunkData.length} bytes) to ${targetWorkers.length} workers`);

        // Try to send chunk to each target worker
        const targetResults = await replicateChunkToWorkers(chunkId, chunkData, chunkInfo, targetWorkers);

        // Categorize results
        const successfulTargets = targetResults.filter(r => r.status === "success").map(r => r.target);
        const failedTargets = targetResults.filter(r => r.status === "failed").map(r => r.target);

        if (successfulTargets.length > 0) {
          replicated.push({
            chunkId,
            targets: successfulTargets,
            status: "success"
          });
        }

        if (failedTargets.length > 0) {
          failed.push({
            chunkId,
            targets: failedTargets,
            status: "failed",
            error: "Some target workers failed"
          });
        }
      }

      // Prepare response
      const response: ReReplicateResponse = {
        success: failed.length === 0 && notFound.length === 0,
        replicated,
        failed,
        notFound,
        summary: {
          totalRequested: chunkIds.length,
          totalReplicated: replicated.length,
          totalFailed: failed.length,
          totalNotFound: notFound.length
        }
      };

      log(`Re-replication completed: ${response.summary.totalReplicated} successful, ${response.summary.totalFailed} failed, ${response.summary.totalNotFound} not found`);

      res.status(200).json(response);

    } catch (err) {
      error("Re-replication error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
}

// Helper function to replicate a chunk to multiple workers
async function replicateChunkToWorkers(
  chunkId: string,
  chunkData: Buffer,
  chunkInfo: any,
  targetWorkers: string[]
): Promise<Array<{ target: string; status: "success" | "failed"; error?: string }>> {
  const results: Array<{ target: string; status: "success" | "failed"; error?: string }> = [];

  // Send chunk to each target worker in parallel
  const promises = targetWorkers.map(async (targetWorker) => {
    try {
      // Prepare the upload request
      const uploadUrl = `${targetWorker}/uploadChunk`;
      
      log(`Sending chunk ${chunkId} to ${targetWorker}`);

      const response = await axios.post(uploadUrl, chunkData, {
        headers: {
          "Content-Type": "application/octet-stream",
          "x-chunk-id": chunkId,
          "x-filename": chunkInfo.filename,
          "x-chunk-index": chunkInfo.index.toString(),
          "x-chunk-size": chunkData.length.toString(),
          "x-total-size": chunkData.length.toString() // For single chunk replication
        },
        timeout: 30000, // 30 second timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (response.status === 200) {
        log(`Successfully replicated chunk ${chunkId} to ${targetWorker}`);
        return { target: targetWorker, status: "success" as const };
      } else {
        warn(`Failed to replicate chunk ${chunkId} to ${targetWorker}: HTTP ${response.status}`);
        return { target: targetWorker, status: "failed" as const, error: `HTTP ${response.status}` };
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      error(`Failed to replicate chunk ${chunkId} to ${targetWorker}:`, errorMessage);
      return { target: targetWorker, status: "failed" as const, error: errorMessage };
    }
  });

  // Wait for all replication attempts to complete
  const resultsArray = await Promise.all(promises);
  results.push(...resultsArray);

  return results;
}
