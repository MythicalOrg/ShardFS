import { Request, Response } from "express";
import { log, error, warn } from "../utils/logger";
import { storage } from "../services/storage";

// Download route - handles serving file chunks to CLI
export function setupDownloadRoute(app: any): void {
  app.get("/downloadChunk/:chunkId", async (req: Request, res: Response) => {
    try {
      const { chunkId } = req.params;

      // Validate chunk ID
      if (!chunkId) {
        return res.status(400).json({
          error: "Chunk ID is required"
        });
      }

      log(`Download request for chunk: ${chunkId}`);

      // Check if chunk exists
      if (!storage.hasChunk(chunkId)) {
        warn(`Chunk ${chunkId} not found`);
        return res.status(404).json({
          error: "Chunk not found",
          chunkId
        });
      }

      // Get chunk metadata
      const chunkInfo = storage.getChunkInfo(chunkId);
      if (!chunkInfo) {
        error(`Chunk ${chunkId} exists but metadata is missing`);
        return res.status(500).json({
          error: "Chunk metadata corrupted"
        });
      }

      // Read chunk data from storage
      const chunkData = await storage.getChunk(chunkId);
      if (!chunkData) {
        error(`Failed to read chunk ${chunkId} from disk`);
        return res.status(500).json({
          error: "Failed to read chunk data"
        });
      }

      // Set response headers
      res.set({
        "Content-Type": "application/octet-stream",
        "Content-Length": chunkData.length.toString(),
        "x-chunk-id": chunkId,
        "x-filename": chunkInfo.filename,
        "x-chunk-index": chunkInfo.index.toString(),
        "x-chunk-size": chunkData.length.toString()
      });

      // Send chunk data
      res.send(chunkData);

      log(`Served chunk ${chunkId} (${chunkData.length} bytes)`);

    } catch (err) {
      error("Download chunk error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Alternative endpoint for chunk info (without downloading data)
  app.get("/chunkInfo/:chunkId", async (req: Request, res: Response) => {
    try {
      const { chunkId } = req.params;

      if (!chunkId) {
        return res.status(400).json({
          error: "Chunk ID is required"
        });
      }

      // Check if chunk exists
      if (!storage.hasChunk(chunkId)) {
        return res.status(404).json({
          error: "Chunk not found",
          chunkId
        });
      }

      // Get chunk metadata
      const chunkInfo = storage.getChunkInfo(chunkId);
      if (!chunkInfo) {
        return res.status(500).json({
          error: "Chunk metadata corrupted"
        });
      }

      // Return chunk info
      res.json({
        chunkId,
        filename: chunkInfo.filename,
        size: chunkInfo.size,
        index: chunkInfo.index,
        createdAt: chunkInfo.createdAt
      });

    } catch (err) {
      error("Get chunk info error:", err);
      res.status(500).json({
        error: "Internal server error"
      });
    }
  });

  // Endpoint to list all chunks on this worker
  app.get("/chunks", async (req: Request, res: Response) => {
    try {
      const chunkIds = storage.getAllChunkIds();
      const chunks = chunkIds.map(id => {
        const info = storage.getChunkInfo(id);
        return {
          id,
          filename: info?.filename,
          size: info?.size,
          index: info?.index,
          createdAt: info?.createdAt
        };
      });

      const stats = await storage.getStorageStats();

      res.json({
        workerId: require("os").hostname(),
        totalChunks: chunks.length,
        totalSize: stats.totalSize,
        freeSpace: stats.freeSpace,
        chunks
      });

    } catch (err) {
      error("List chunks error:", err);
      res.status(500).json({
        error: "Internal server error"
      });
    }
  });
}
