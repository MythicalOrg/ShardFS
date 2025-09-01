import { Request, Response } from "express";
import { storage } from "../services/storage";
import { log, error } from "../utils/logger";

export function setupResetRoute(app: any): void {
  /**
   * POST /reset
   * Clears all stored chunks and metadata
   */
  app.post("/reset", async (req: Request, res: Response) => {
    try {
      log("Reset request received");
      await storage.clearStorage();
      log("Storage reset completed");
      return res.json({ message: "Storage reset successfully" });
    }
    catch (err) {
        error("Reset error:", err); 
        res.status(500).json({
            error: "Internal server error",
            message: err instanceof Error ? err.message : "Unknown error",
        });
    }
  });
}