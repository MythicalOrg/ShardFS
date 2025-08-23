
export type WSMessage =
  | {
      type: "worker:heartbeat";
      data: {
        id: string;
        host: string;
        freeBytes: number;
        totalBytes?: number;
      };
    }
  | { type: "worker:info"; data: any }
  | { type: "dashboard:subscribe" }
  | { type: "admin:command"; data: any };
