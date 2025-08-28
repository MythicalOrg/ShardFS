import fs from "fs";
import path from "path";
import axios from "axios";

import type { FilePlan } from "./types";
import { makeMasterClient } from "./http";


function extractPlan(data: any): FilePlan {
  if (!data?.plan || !Array.isArray(data.plan.chunks)) {
    throw new Error("Malformed plan response: missing 'plan' or 'plan.chunks'");
  }
  return data.plan;
}

/**
 * Downloads a file by fetching chunks from worker replicas with failover.
 * 1) GET /api/download/:filename -> DownloadMeta (chunkId -> replicas)
 * 2) For i in [0..numChunks-1], request chunk stream from the first healthy replica.
 * 3) Append in order to destination file.
 */
export async function download(
  filename: string,
  destPath: string,
  masterUrl: string,
  timeoutMs: number = 60000
): Promise<void> {
  const api = makeMasterClient(masterUrl, timeoutMs);
  const metaRes = await api.get<FilePlan>(`/api/download/${encodeURIComponent(filename)}`);
  const meta = extractPlan(metaRes.data);

  if (!meta || !Array.isArray(meta.chunks)) {
    throw new Error("Invalid download metadata from master.");
  }

  const outAbs = path.resolve(destPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const out = fs.createWriteStream(outAbs, { flags: "w" });
  try {
    for (let i = 0; i < meta.chunks.length; i++) {
      const chunk = meta.chunks[i];
      if (!chunk || !Array.isArray(chunk.workers) || chunk.workers.length === 0) {
        throw new Error(`No replicas found for chunk index ${i}`);
      }

      let success = false;
      let lastErr: unknown = null;

      for (const workerAddr of chunk.workers) {
        const url = `http://${workerAddr}/downloadChunk/${encodeURIComponent(chunk.id)}`;
        try {
          const res = await axios.get(url, { responseType: "stream", timeout: 120_000 });
          await new Promise<void>((resolve, reject) => {
            res.data.on("error", reject);
            res.data.on("end", resolve);
            res.data.pipe(out, { end: false });
          });
          success = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!success) {
        throw new Error(`Failed to retrieve ${chunk.id}: ${lastErr}`);
      }
    }
  } finally {
    out.close();
  }
}
