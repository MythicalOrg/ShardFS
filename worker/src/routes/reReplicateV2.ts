// Re-Replication Route V2 - Replicates chunks to ONLY the FIRST worker in targetWorkers array (optimized for RF=2)
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

// Re-replication route V2 - handles chunk replication to other workers
// Since replication factor is 2, only uses the first target worker
export function setupReReplicateRouteV2(app: any): void {
  app.post("/reReplicateV2", async (req: Request, res: Response) => {
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

      log(`Re-replication V2 request: ${chunkIds.length} chunks to first worker in list`);

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

        // Since replication factor is 2, we only need to replicate to the first target worker
        const targetWorker = targetWorkers[0];
        log(`Replicating chunk ${chunkId} (${chunkData.length} bytes) to ${targetWorker}`);

        // Try to send chunk to the target worker
        const result = await replicateChunkToWorker(chunkId, chunkData, chunkInfo, targetWorker);

        if (result.status === "success") {
          replicated.push({
            chunkId,
            targets: [targetWorker],
            status: "success"
          });
        } else {
          failed.push({
            chunkId,
            targets: [targetWorker],
            status: "failed",
            error: result.error
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

      log(`Re-replication V2 completed: ${response.summary.totalReplicated} successful, ${response.summary.totalFailed} failed, ${response.summary.totalNotFound} not found`);

      res.status(200).json(response);

    } catch (err) {
      error("Re-replication V2 error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
}

// Helper function to replicate a chunk to a single worker
async function replicateChunkToWorker(
  chunkId: string,
  chunkData: Buffer,
  chunkInfo: any,
  targetWorker: string
): Promise<{ status: "success" | "failed"; error?: string }> {
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
      return { status: "success" as const };
    } else {
      warn(`Failed to replicate chunk ${chunkId} to ${targetWorker}: HTTP ${response.status}`);
      return { status: "failed" as const, error: `HTTP ${response.status}` };
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    error(`Failed to replicate chunk ${chunkId} to ${targetWorker}:`, errorMessage);
    return { status: "failed" as const, error: errorMessage };
  }
}
