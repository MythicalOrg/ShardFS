import { requestDeleteFile } from "../api";

export default async function deleteFile(filename: string) {
  console.log(`🗑️ Deleting file: ${filename}`);

  try {
    const res = await requestDeleteFile(filename);
    if (res.success) {
      console.log(`✅ File "${filename}" deleted successfully.`);
    } else {
      console.error(
        `❌ Delete failed for "${filename}":`,
        res.message || "unknown error"
      );
    }
  } catch (err) {
    console.error(`❌ Error deleting file "${filename}":`, err);
  }
}
