// Reset Route - Deletes all chunks and resets chunks.json to empty array
import { Request, Response } from "express";
import { log, error } from "../utils/logger";
import { storage } from "../services/storage";

export function setupResetRoute(app: any): void {
  app.post("/reset", async (req: Request, res: Response) => {
    try {
      log("🔄 Reset request received - clearing all chunks and metadata");

      // Get current storage stats for logging
      const stats = await storage.getStorageStats();
      log(`📊 Current storage: ${stats.totalChunks} chunks, ${stats.totalSize} bytes`);

      // Clear all chunks from storage
      const deletedChunks = await storage.clearAllChunks();
      
      log(`🗑️ Deleted ${deletedChunks.length} chunks from storage`);
      
      // Verify reset was successful
      const newStats = await storage.getStorageStats();
      
      if (newStats.totalChunks === 0) {
        log("✅ Reset completed successfully - storage is now empty");
        res.status(200).json({
          success: true,
          message: "Worker storage reset successfully",
          deletedChunks: deletedChunks.length,
          newStats: {
            totalChunks: newStats.totalChunks,
            totalSize: newStats.totalSize,
            freeSpace: newStats.freeSpace
          }
        });
      } else {
        error("❌ Reset failed - chunks still exist in storage");
        res.status(500).json({
          success: false,
          error: "Failed to reset storage completely",
          remainingChunks: newStats.totalChunks
        });
      }

    } catch (err) {
      error("Reset route error:", err);
      res.status(500).json({
        success: false,
        error: "Internal server error during reset",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
}
