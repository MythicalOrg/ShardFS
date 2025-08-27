
import axios from "axios";
import { MASTER_URL } from "./config";
import type { FilePlan, ListFiles } from "./types";

const api = axios.create({
  baseURL: MASTER_URL,
  timeout: 60_000,
});

function extractPlan(data: any): FilePlan {
  const plan = data?.plan ?? data;
  if (!plan || !Array.isArray(plan.chunks)) {
    throw new Error("Malformed plan response: missing 'chunks' array");
  }
  return plan;
}

export async function requestUploadPlan(filename: string, size: number): Promise<FilePlan> {
  const res = await api.post("/api/register", { filename, size });
  return extractPlan(res.data);
}

export async function requestDownloadMeta(filename: string): Promise<FilePlan> {
  const res = await api.get(`/api/download/${encodeURIComponent(filename)}`);
  return extractPlan(res.data);
}

export async function listFiles(): Promise<ListFiles> {
  const res = await api.get("/api/getallfiles");
  return res.data;
}
