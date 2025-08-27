import fs from "fs";
import path from "path";
import axios from "axios";
import { requestUploadPlan } from "../api";
import type { FilePlan } from "../types";

export default async function upload(filepath: string): Promise<void> {
  const abs = path.resolve(filepath);
  if (!fs.existsSync(abs)) {
    throw new Error(`file not found: ${abs}`);
  }

  const stat = fs.statSync(abs);
  const size = stat.size;
  const filename = path.basename(abs);

  console.log(`Uploading ${filename} (${size} bytes)`);


  const plan: FilePlan = await requestUploadPlan(filename, size);
  console.log(`→ chunkSize=${plan.chunkSize}, numChunks=${plan.chunks.length}`);

  // for each chunk, stream to each assigned worker
  for (let i = 0; i < plan.chunks.length; i++) {
   const { id: chunkId, workers } = plan.chunks[i];
    const start = i * plan.chunkSize;
    const end = Math.min(start + plan.chunkSize, size);
    const chunkLength = end - start;

    if (!workers || workers.length === 0) {
      throw new Error(`No workers assigned for chunk ${chunkId}`);
    }

    console.log(`  • chunk ${i}/${plan.chunks.length - 1} [${start}-${end - 1}] → ${workers.join(", ")}`);


    const streamFactory = () => fs.createReadStream(abs, { start, end: end - 1 });

    // replication
    await Promise.all(
      workers.map(async (workerAddr) => {
        const url = `http://${workerAddr}/uploadChunk`;
        const chunkStream = streamFactory();

        await axios.post(url, chunkStream, {
          headers: {
            "Content-Type": "application/octet-stream",
            "x-chunk-id": chunkId,
            "x-filename": filename,
            "x-chunk-index": String(i),
            "x-chunk-size": String(chunkLength),
            "x-total-size": String(size)
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 5 * 60_000
        });
      })
    );
  }

  console.log("Upload completed.");
}
