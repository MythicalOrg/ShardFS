import { listFiles } from "../api";

export default async function list(): Promise<void> {
  const result = await listFiles();
  if (!result.files.length) {
    console.log("No files found.");
    return;
  }

  console.log("Files in ShardFS:");
  for (const f of result.files) {
    console.log(` - ${f.filename} (${f.size} bytes, ${f.chunks.length} chunks)`);
  }
}
