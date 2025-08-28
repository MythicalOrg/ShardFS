import { upload } from "./upload";
import { download } from "./download";
import { listFiles } from "./list";
import type { ListFiles, FilePlan } from "./types";

export interface ShardFSOptions {
  masterUrl: string;
  timeoutMs?: number;
}

// Use CASE : const dfs = new ShardFS({ masterUrl: "http://localhost:9000" , timeoutMs: 120000 });

export class ShardFS {
  private masterUrl: string;
  private timeoutMs?: number;

  constructor(opts: ShardFSOptions) {
    this.masterUrl = opts.masterUrl.replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs;
  }

  async upload(filepath: string): Promise<void> {
    return upload(filepath, this.masterUrl, this.timeoutMs ?? 60000);
  }

  async download(filename: string, destPath: string): Promise<void> {
    return download(filename, destPath, this.masterUrl, this.timeoutMs ?? 60000);
  }

  async list(): Promise<ListFiles> {
    return listFiles(this.masterUrl, this.timeoutMs);
  }
}

export type { ListFiles, FilePlan };
