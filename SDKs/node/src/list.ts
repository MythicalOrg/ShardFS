import type { ListFiles } from "./types";
import { makeMasterClient } from "./http";

export async function listFiles(masterUrl: string, timeoutMs = 60000): Promise<ListFiles> {
  const api = makeMasterClient(masterUrl, timeoutMs);
  const res = await api.get<ListFiles>("/api/getallfiles");
  return res.data;
}
