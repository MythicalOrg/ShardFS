import checkDiskSpace from "check-disk-space";
import path from "path";
import { log, warn } from "./logger";

// Utility to get actual disk space information using check-disk-space
export async function getDiskSpaceInfo(storagePath: string): Promise<{ free: number; total: number; used: number }> {
  try {
    // On Windows, check-disk-space expects a drive root like "C:\"
    let diskPath = storagePath;
    if (process.platform === "win32") {
      // Resolve to absolute path, then get the drive letter root (e.g. "C:\")
      const abs = path.resolve(storagePath);
      diskPath = abs.slice(0, 3); // "C:\" from "C:\Users\..."
    }
    if(process.platform === "linux") {
      const abs = path.resolve(storagePath);
      diskPath = path.parse(abs).root; 
    }
    console.log("Checking disk space for path:", diskPath);
    const { free, size: total } = await checkDiskSpace(diskPath);
    const used = total - free;
    return { free, total, used };
  } catch (err) {
    warn("Failed to get disk space info:", err);
    return { free: 0, total: 0, used: 0 };
  }
}

// Check if we have enough space for a chunk
export async function hasEnoughSpace(path: string, requiredBytes: number): Promise<boolean> {
  const spaceInfo = await getDiskSpaceInfo(path);
  return spaceInfo.free >= requiredBytes;
}

// Get human-readable disk space
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}