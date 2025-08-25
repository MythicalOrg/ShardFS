import { Router, Request, Response } from "express";
import { mappingStore } from "../services/mappingStore";

const router = Router();

router.get("/getallfiles", (req: Request, res: Response) => {
  try {
    const files = mappingStore.listFiles(); // Array<FilePlan>

    const response = {
      totalFiles: files.length,
      files: files.map((file) => ({
        filename: file.filename,
        size: file.size,
        chunkSize: file.chunkSize,
        chunkCount: file.chunks.length,
        replicationFactor:
          file.chunks.length > 0 ? file.chunks[0].workers.length : 0,
        createdAt: file.createdAt,
        chunks: file.chunks.map((chunk) => ({
          id: chunk.id,
          size: chunk.size,
          workers: chunk.workers, // Could resolve to worker host later
          index: chunk.index,
        })),
      })),
    };

    res.json(response);
  } catch (err) {
    console.error("Error in getAllFiles:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

/**
 * Example Response of this endpoint:
 * {
  "totalFiles": 1,
  "files": [
    {
      "filename": "movie.mp4",
      "size": 10485760,
      "chunkSize": 5242880,
      "chunkCount": 2,
      "replicationFactor": 2,
      "createdAt": 1692953200000,
      "chunks": [
        {
          "id": "chunk-0",
          "size": 5242880,
          "workers": ["worker-1", "worker-2"],
          "index": 0
        },
        {
          "id": "chunk-1",
          "size": 5242880,
          "workers": ["worker-1", "worker-2"],
          "index": 1
        }
      ]
    }
  ]
}

 */
