import fs from "fs";
import path from "path";
import { log, error, warn } from "../utils/logger";
import { getConfig } from "../config";
import { getDiskSpaceInfo, formatBytes } from "../utils/diskSpace";

// Interface for chunk metadata
interface ChunkInfo {
  id: string;
  filename: string;
  size: number;
  index: number;
  createdAt: number;
}

// Storage service - manages file chunks on disk
class StorageService {
  private storageDir: string;
  private chunks: Map<string, ChunkInfo> = new Map();
  private metadataFile: string;

  constructor() {
    const config = getConfig();
    this.storageDir = config.STORAGE_DIR;
    this.metadataFile = path.join(this.storageDir, "chunks.json");
  }

  async initialize(): Promise<void> {
    try {
      // Create storage directory if it doesn't exist
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        log(`Created storage directory: ${this.storageDir}`);
      }

      // Load existing chunk metadata
      await this.loadMetadata();
      
      log(`Storage initialized. Found ${this.chunks.size} existing chunks`);
    } catch (err) {
      error("Failed to initialize storage:", err);
      throw err;
    }
  }

  // Save a chunk to disk
  async saveChunk(chunkId: string, data: Buffer, metadata: Omit<ChunkInfo, "createdAt">): Promise<void> {
    try {
      const chunkPath = this.getChunkPath(chunkId);
      
      // Write chunk data to disk
      fs.writeFileSync(chunkPath, data);
      
      // Store metadata
      const chunkInfo: ChunkInfo = {
        ...metadata,
        createdAt: Date.now()
      };
      
      this.chunks.set(chunkId, chunkInfo);
      
      // Save metadata to disk
      await this.saveMetadata();
      
      log(`Saved chunk ${chunkId} (${data.length} bytes)`);
    } catch (err) {
      error(`Failed to save chunk ${chunkId}:`, err);
      throw err;
    }
  }

  // Read a chunk from disk
  async getChunk(chunkId: string): Promise<Buffer | null> {
    try {
      const chunkPath = this.getChunkPath(chunkId);
      
      // Check if chunk exists
      if (!fs.existsSync(chunkPath)) {
        warn(`Chunk ${chunkId} not found on disk`);
        return null;
      }

      // Read chunk data
      const data = fs.readFileSync(chunkPath);
      
      log(`Read chunk ${chunkId} (${data.length} bytes)`);
      return data;
    } catch (err) {
      error(`Failed to read chunk ${chunkId}:`, err);
      return null;
    }
  }

  // Delete a chunk from disk
  async deleteChunk(chunkId: string): Promise<boolean> {
    try {
      const chunkPath = this.getChunkPath(chunkId);
      
      // Remove from disk
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
      
      // Remove from metadata
      this.chunks.delete(chunkId);
      
      // Save updated metadata
      await this.saveMetadata();
      
      log(`Deleted chunk ${chunkId}`);
      return true;
    } catch (err) {
      error(`Failed to delete chunk ${chunkId}:`, err);
      return false;
    }
  }

  // Get storage statistics (now async!)
  async getStorageStats(): Promise<{ totalChunks: number; totalSize: number; freeSpace: number }> {
    let totalSize = 0;
    
    // Calculate total size of all chunks
    for (const chunk of this.chunks.values()) {
      totalSize += chunk.size;
    }

    // Get free space on disk (now async)
    const freeSpace = await this.getFreeDiskSpace();

    return {
      totalChunks: this.chunks.size,
      totalSize,
      freeSpace
    };
  }

  // Get list of all chunk IDs
  getAllChunkIds(): string[] {
    return Array.from(this.chunks.keys());
  }

  // Check if chunk exists
  hasChunk(chunkId: string): boolean {
    return this.chunks.has(chunkId);
  }

  // Get chunk metadata
  getChunkInfo(chunkId: string): ChunkInfo | undefined {
    return this.chunks.get(chunkId);
  }

  // Clear all chunks from storage and reset metadata
  async clearAllChunks(): Promise<string[]> {
    try {
      const deletedChunkIds: string[] = [];
      
      // Get all chunk IDs before clearing
      const chunkIds = Array.from(this.chunks.keys());
      
      // Delete each chunk file from disk
      for (const chunkId of chunkIds) {
        const chunkPath = this.getChunkPath(chunkId);
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
          deletedChunkIds.push(chunkId);
        }
      }
      
      // Clear the chunks Map
      this.chunks.clear();
      
      // Save empty metadata to disk (this will create an empty array in chunks.json)
      await this.saveMetadata();
      
      log(`Cleared all chunks: ${deletedChunkIds.length} files deleted`);
      return deletedChunkIds;
    } catch (err) {
      error("Failed to clear all chunks:", err);
      throw err;
    }
  }

  // Private helper methods
  private getChunkPath(chunkId: string): string {
    return path.join(this.storageDir, `${chunkId}`);
  }

  private async loadMetadata(): Promise<void> {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, "utf8");
        const metadata = JSON.parse(data);
        
        // Convert array back to Map
        this.chunks = new Map(metadata);
        log(`Loaded ${this.chunks.size} chunk metadata entries`);
      }
    } catch (err) {
      warn("Failed to load chunk metadata:", err);
      // Start with empty metadata if loading fails
      this.chunks = new Map();
    }
  }

  private async saveMetadata(): Promise<void> {
    try {
      // Convert Map to array for JSON serialization
      const metadata = Array.from(this.chunks.entries());
      const data = JSON.stringify(metadata, null, 2);
      
      fs.writeFileSync(this.metadataFile, data);
    } catch (err) {
      error("Failed to save chunk metadata:", err);
      throw err;
    }
  }

  // Now async!
  private async getFreeDiskSpace(): Promise<number> {
    try {
      const spaceInfo = await getDiskSpaceInfo(this.storageDir);
      log(`Disk space - Free: ${formatBytes(spaceInfo.free)}, Total: ${formatBytes(spaceInfo.total)}`);
      return spaceInfo.free;
    } catch (err) {
      warn("Failed to get disk space:", err);
      return 0;
    }
  }
}

// Create singleton instance
const storageService = new StorageService();

// Export setup function
export async function setupStorage(): Promise<void> {
  await storageService.initialize();
}

// Export storage service methods (now async for getStorageStats)
export const storage = {
  saveChunk: storageService.saveChunk.bind(storageService),
  getChunk: storageService.getChunk.bind(storageService),
  deleteChunk: storageService.deleteChunk.bind(storageService),
  getStorageStats: storageService.getStorageStats.bind(storageService), // now async!
  getAllChunkIds: storageService.getAllChunkIds.bind(storageService),
  hasChunk: storageService.hasChunk.bind(storageService),
  getChunkInfo: storageService.getChunkInfo.bind(storageService),
  clearAllChunks: storageService.clearAllChunks.bind(storageService)
};