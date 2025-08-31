// src/types/cluster.ts

export type Worker = {
  status: string;
  id: string;
  host: string;
  freeBytes: number;
  totalBytes: number;
  metadata?: {
    totalChunks: number;
    totalSize: number;
    hostname: string;
  };
};

export type Chunk = {
  id: string;
  size: number;
  workers: string[];
};

export type FileInfo = {
  filename: string;
  chunks: Chunk[];
};

export type ClusterSnapshotMsg = {
  type: "cluster:snapshot";
  data: {
    workers: Worker[];
    files: FileInfo[];
  };
};

export type ClusterUpdateMsg = {
  type: "cluster:update";
  data: {
    workers: Worker[];
    files: FileInfo[];
  };
};

export type MasterInfoMsg = {
  type: "master:info";
  data: {
    time: number;
    files: number;
  };
};

export type WorkersListMsg = {
  type: "workers:list";
  data: Worker[];
};

export type WorkerHeartbeatMsg = {
  type: "worker:heartbeat";
  data: Worker; // same shape as Worker
};

// ✅ Add explicit WS infra messages
export type PongMsg = {
  type: "pong";
};

export type PingMsg = {
  type: "ping";
};

// Extend WsMessage
export type WsMessage =
  | ClusterSnapshotMsg
  | ClusterUpdateMsg
  | MasterInfoMsg
  | WorkersListMsg
  | WorkerHeartbeatMsg
  | PongMsg
  | PingMsg;
