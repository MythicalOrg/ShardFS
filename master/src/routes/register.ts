
import express from "express";
import { planFileChunks } from "../services/chunkPlanner";
import { log } from "../utils/logger";

const router = express.Router();

/**
 * POST /register
 * body: { filename, size }
 * returns: file plan with chunks and worker assignments
 */
router.post("/register", async (req, res) => {
  try {
    const { filename, size } = req.body;
    if (!filename || !size) {
      return res.status(400).json({ error: "filename and size are required" });
    }
    const sizeNum = Number(size);
    if (Number.isNaN(sizeNum) || sizeNum <= 0) {
      return res.status(400).json({ error: "size must be a positive number" });
    }

    const plan = planFileChunks(filename, sizeNum);
    log("Planned file:", filename, "chunks:", plan.chunks.length);
    return res.json({ plan });
  } catch (err: any) {
    if (err.message.includes("No alive workers")) {
      return res.status(503).json({ error: "No workers available" });
    }
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

export default router;
