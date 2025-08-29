// These are typings used across Master directory :)

export type WorkerId = string;

export interface WorkerInfo {
  id: WorkerId;
  host: string; // e.g., ip:port or ws id
  freeBytes: number;
  totalBytes?: number;
  lastHeartbeat: number; // epoch ms
  metadata?: Record<string, any>;
  status: "alive" | "dead";
}

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
  status?: "active" | "deleting" | "deleted";
}
