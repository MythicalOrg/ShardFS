import { Request, Response } from "express";
import { storage } from "../services/storage";
import { log, error, warn } from "../utils/logger";

export function setupDeleteRoute(app: any): void {
  /**
   * DELETE /deleteChunk/:chunkId
   * Removes a chunk from disk and metadata
   */
  app.delete("/deleteChunk/:chunkId", async (req: Request, res: Response) => {
    try {
      const { chunkId } = req.params;

      if (!chunkId) {
        return res.status(400).json({ error: "Chunk ID is required" });
      }

      log(`Delete request for chunk: ${chunkId}`);

      // Check if chunk exists
      if (!storage.hasChunk(chunkId)) {
        warn(`Chunk ${chunkId} not found for deletion`);
        return res.status(404).json({
          error: "Chunk not found",
          chunkId,
        });
      }

      // Perform deletion
      const success = await storage.deleteChunk(chunkId);
      if (!success) {
        return res.status(500).json({
          error: "Failed to delete chunk",
          chunkId,
        });
      }

      log(`Deleted chunk ${chunkId}`);
      return res.json({
        message: `Chunk ${chunkId} deleted successfully`,
      });
    } catch (err) {
      error("Delete chunk error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}
