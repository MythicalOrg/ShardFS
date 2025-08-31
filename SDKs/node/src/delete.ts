import { makeMasterClient } from "./http";

export async function deleteFile(filename: string , masterUrl:string , timeout : number = 60000): Promise<void> {
  console.log(`🗑️ Deleting file: ${filename}`);
  const api = makeMasterClient(masterUrl, timeout);

  try {
    const response = await api.delete(`/api/delete/${encodeURIComponent(filename)}`);
    const res = response.data;
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