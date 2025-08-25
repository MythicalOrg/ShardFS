import axios from "axios";
import { MASTER_URL } from "./config";
import type { FilePlan, ListFiles } from "./types";

const api = axios.create({
  baseURL: MASTER_URL,
  timeout: 60_000
});

// Ask master for an upload plan
export async function requestUploadPlan(filename: string, size: number): Promise<FilePlan> {
  const res = await api.post<FilePlan>("/api/register", { filename, size });
  return res.data;
}

// Ask master for download metadata
export async function requestDownloadMeta(filename: string): Promise<FilePlan> {
  const res = await api.get<FilePlan>(`/api/download/${encodeURIComponent(filename)}`);
  return res.data;
}

// List files
export async function listFiles(): Promise<ListFiles> {
  const res = await api.get<ListFiles>("/api/getallfiles");
  return res.data;
}
