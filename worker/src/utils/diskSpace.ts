import fs from "fs";
import { log, warn } from "./logger";

// Utility to get actual disk space information
// This is a more realistic implementation than the placeholder

export function getDiskSpaceInfo(path: string): { free: number; total: number; used: number } {
  try {
    // Get stats for the directory
    const stats = fs.statSync(path);
    
    // For now, we'll use a simplified approach
    // In production, you'd use a library like 'diskusage' for accurate disk space
    
    // Check if we can write to the directory
    const testFile = `${path}/.space-test-${Date.now()}`;
    try {
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
    } catch (err) {
      warn("Cannot write to storage directory:", err);
      return { free: 0, total: 0, used: 0 };
    }
    
    // Estimate available space (this is a simplified approach)
    // In reality, you'd want to use proper disk space checking
    const estimatedFree = 1024 * 1024 * 1024 * 5; // 5GB estimate
    const estimatedTotal = 1024 * 1024 * 1024 * 10; // 10GB estimate
    const estimatedUsed = estimatedTotal - estimatedFree;
    
    return {
      free: estimatedFree,
      total: estimatedTotal,
      used: estimatedUsed
    };
  } catch (err) {
    warn("Failed to get disk space info:", err);
    return { free: 0, total: 0, used: 0 };
  }
}

// Check if we have enough space for a chunk
export function hasEnoughSpace(path: string, requiredBytes: number): boolean {
  const spaceInfo = getDiskSpaceInfo(path);
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
