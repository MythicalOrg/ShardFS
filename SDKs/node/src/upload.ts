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
 * Uploads a local file using raw octet-stream chunks to worker replicas.
 * Flow:
 * 1) POST /api/upload { filename, size } -> FilePlan
 * 2) For each chunk in plan.chunks, stream byte-range to each worker via POST /uploadChunk
 */
export async function upload(
  filepath: string,
  masterUrl: string,
  timeoutMs: number = 60000
): Promise<void> {
  const abs = path.resolve(filepath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

  const stat = fs.statSync(abs);
  const size = stat.size;
  const filename = path.basename(abs);

  const api = makeMasterClient(masterUrl, timeoutMs);

  // 1) ask master for the plan
  const planRes = await api.post<FilePlan>("/api/register", { filename, size });
  const plan = extractPlan(planRes.data);

  if (!Array.isArray(plan.chunks) || plan.chunks.length === 0) {
    throw new Error("Master returned empty chunk plan.");
  }

  // 2) send each chunk to its assigned replicas
  for (let i = 0; i < plan.chunks.length; i++) {
    const { id: chunkId, workers } = plan.chunks[i];
    const start = i * plan.chunkSize;
    const end = Math.min(start + plan.chunkSize, size); // non-inclusive
    const chunkLen = end - start;
    if (!workers || workers.length === 0) {
      throw new Error(`No workers assigned for chunk ${chunkId}`);
    }

    const streamFactory = () => fs.createReadStream(abs, { start, end: end - 1 });

    // upload to all replicas in parallel
    await Promise.all(
      workers.map(async (workerAddr) => {
        const url = `http://${workerAddr}/uploadChunk`;
        const bodyStream = streamFactory();

        await axios.post(url, bodyStream, {
          headers: {
            "Content-Type": "application/octet-stream",
            "x-chunk-id": chunkId,
            "x-filename": filename,
            "x-chunk-index": String(i),
            "x-chunk-size": String(chunkLen),
            "x-total-size": String(size)
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300_000
        });
      })
    );
  }
}
