import { listFiles } from "../api";

export default async function list(): Promise<void> {
  const files = await listFiles();
  if (!files.length) {
    console.log("No files found.");
    return;
  }

  console.log("Files in ShardFS:");
  for (const f of files) {
    console.log(` - ${f.filename} (${f.size} bytes, ${f.numChunks} chunks)`);
  }
}
