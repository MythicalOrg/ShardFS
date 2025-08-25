
export type WorkerId = string;

export interface ChunkPlan {
  id: string;
  size: number;
  workers: WorkerId[]; // list of assigned workers for this chunk (replication)
  index: number;
}

export interface FilePlan {
  filename: string;
  size: number;
  chunkSize: number;
  chunks: ChunkPlan[];
  createdAt: number;
}

export interface ListFiles {
    totalFiles: number;
    files: {
        filename: string;
        size: number;
        chunkSize: number;
        chunkCount: number;
        replicationFactor: number;
        createdAt: number;
        chunks: ChunkPlan[];
    }[];
}


