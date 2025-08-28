import { Request, Response } from "express";
import { log, error } from "../utils/logger";
import { storage } from "../services/storage";

// Upload route - handles receiving file chunks from CLI
export function setupUploadRoute(app: any): void {
  app.post("/uploadChunk", async (req: Request, res: Response) => {
    try {
      // Extract chunk metadata from headers
      const chunkId = req.headers["x-chunk-id"] as string;
      const filename = req.headers["x-filename"] as string;
      const chunkIndex = parseInt(req.headers["x-chunk-index"] as string);
      const chunkSize = parseInt(req.headers["x-chunk-size"] as string);
      const totalSize = parseInt(req.headers["x-total-size"] as string);

      // Validate required headers
      if (!chunkId || !filename || isNaN(chunkIndex) || isNaN(chunkSize)) {
        return res.status(400).json({
          error: "Missing required headers: x-chunk-id, x-filename, x-chunk-index, x-chunk-size"
        });
      }

      // Validate request body
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({
          error: "Request body must be binary data"
        });
      }

      const chunkData = req.body as Buffer;

      // Validate chunk size matches header
      if (chunkData.length !== chunkSize) {
        return res.status(400).json({
          error: `Chunk size mismatch: expected ${chunkSize}, got ${chunkData.length}`
        });
      }

      log(`Received chunk ${chunkId} (${chunkData.length} bytes) for file ${filename}`);

      // Check if we have enough space
      const stats = await storage.getStorageStats();
      if (stats.freeSpace < chunkData.length) {
        return res.status(507).json({
          error: "Insufficient storage space",
          required: chunkData.length,
          available: stats.freeSpace
        });
      }

      // Save chunk to storage
      await storage.saveChunk(chunkId, chunkData, {
        id: chunkId,
        filename,
        size: chunkData.length,
        index: chunkIndex
      });

      // Return success response
      res.status(200).json({
        success: true,
        chunkId,
        size: chunkData.length,
        message: "Chunk saved successfully"
      });

    } catch (err) {
      error("Upload chunk error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Optional: endpoint to check if chunk exists
  app.head("/chunk/:chunkId", async (req: Request, res: Response) => {
    try {
      const { chunkId } = req.params;
      
      if (!chunkId) {
        return res.status(400).json({ error: "Chunk ID required" });
      }

      const exists = storage.hasChunk(chunkId);
      
      if (exists) {
        const chunkInfo = storage.getChunkInfo(chunkId);
        res.status(200).set({
          "x-chunk-size": chunkInfo?.size.toString(),
          "x-filename": chunkInfo?.filename
        });
      } else {
        res.status(404);
      }
      
      res.end();
    } catch (err) {
      error("Check chunk error:", err);
      res.status(500).end();
    }
  });
}
