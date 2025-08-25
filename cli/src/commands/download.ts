import fs from "fs";
import path from "path";
import axios from "axios";
import { requestDownloadMeta } from "../api";
import type { FilePlan } from "../types";

export default async function download(filename: string, dest: string): Promise<void> {
  const meta: FilePlan = await requestDownloadMeta(filename);
  const outPath = path.resolve(dest);

  console.log(`Downloading ${filename} → ${outPath}`);
  console.log(`→ numChunks=${meta.chunks.length}, chunkSize=${meta.chunkSize}`);

  // ensure parent directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // open a single write stream we append to in order
  const out = fs.createWriteStream(outPath, { flags: "w" });

  try {
    for (let i = 0; i < meta.chunks.length; i++) {
      const chunkId = `${filename}_part${i}`;
      const workers = meta.chunks[i].workers;
      if (!workers || workers.length === 0) {
        throw new Error(`Master returned no workers for ${chunkId}`);
      }

      let success = false;
      let lastErr: unknown = null;

      for (const workerAddr of workers) {
        const url = `http://${workerAddr}/downloadChunk/${encodeURIComponent(chunkId)}`;
        try {
          const res = await axios.get(url, { responseType: "stream", timeout: 2 * 60_000 });
          console.log(`  • chunk ${i}/${meta.chunks.length - 1} ← ${workerAddr}`);

          await new Promise<void>((resolve, reject) => {
            res.data.on("error", reject);
            res.data.on("end", resolve);
            res.data.pipe(out, { end: false }); // don't close output until all chunks are written
          });

          success = true;
          break;
        } catch (err) {
          console.log(`failed from ${workerAddr}, trying next replica...`);
          lastErr = err;
        }
      }

      if (!success) {
        throw new Error(`Failed to retrieve ${chunkId}: ${String(lastErr)}`);
      }
    }
  } finally {
    out.end();
  }

  console.log("Download completed.");
}
