
import express from "express";
import { mappingStore } from "../services/mappingStore";

const router = express.Router();

/**
 * GET /download/:filename=...
 * returns the stored FilePlan for the given filename
 */
router.get("/download/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "filename query param required" });
  }
  const plan = mappingStore.getFilePlan(filename);
  if (!plan) {
    return res.status(404).json({ error: "not found" });
  }
  return res.json({ plan });
});

export default router;
