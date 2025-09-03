import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { UsagePoint } from "../components/charts/ClusterUsageCharts";
import type { WsMessage, FileInfo, Chunk } from "../types/cluster";

type WorkerLite = { id: string; status?: string };

type Status = "connecting" | "open" | "closed";

export function useClusterWs(url: string, maxSamples = 300) {
  const { data, status, send } = useWebSocket(url);
  const bufferRef = useRef<UsagePoint[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    if (!data) return;
    const msg = data as WsMessage;

    if (msg.type === "cluster:snapshot") {
      const data = msg.data as
        | { files?: FileInfo[]; history?: UsagePoint[]; workers?: unknown }
        | undefined;
      const history = data?.history;
      if (Array.isArray(history) && history.length > 0) {
        bufferRef.current = history.slice(-maxSamples);
        bump((n) => n + 1);
        return;
      }
      // if no history present, treat snapshot's files as one point
      const files = data?.files ?? [];
      // derive alive set if server sent worker list; otherwise assume all replicas count
      const workersList = Array.isArray(
        (data as unknown as { workers?: unknown })?.workers
      )
        ? ((data as unknown as { workers?: unknown }).workers as WorkerLite[])
        : undefined;
      const aliveSet = Array.isArray(workersList)
        ? new Set(
            workersList.filter((w) => w?.status === "alive").map((w) => w.id)
          )
        : null;

      const logical = files.reduce(
        (acc: number, f: FileInfo) =>
          acc +
          (f.chunks?.reduce((a: number, c: Chunk) => a + (c.size ?? 0), 0) ??
            0),
        0
      );
      const physical = files.reduce((acc: number, f: FileInfo) => {
        const fileSum = (f.chunks ?? []).reduce((a: number, c: Chunk) => {
          const size = c.size ?? 0;
          if (aliveSet) {
            const aliveReplicas = (c.workers ?? []).filter((id) =>
              aliveSet.has(id)
            ).length;
            return a + size * aliveReplicas;
          }
          return a + size * (c.workers?.length ?? 0);
        }, 0);
        return acc + fileSum;
      }, 0);

      bufferRef.current.push({ t: Date.now(), logical, physical });
      if (bufferRef.current.length > maxSamples) bufferRef.current.shift();
      bump((n) => n + 1);
    }

    if (msg.type === "cluster:update") {
      const data = msg.data as
        | { files?: FileInfo[]; workers?: unknown }
        | undefined;
      const files = data?.files ?? [];
      const workersList = Array.isArray(
        (data as unknown as { workers?: unknown })?.workers
      )
        ? ((data as unknown as { workers?: unknown }).workers as WorkerLite[])
        : undefined;
      const aliveSet = Array.isArray(workersList)
        ? new Set(
            workersList.filter((w) => w?.status === "alive").map((w) => w.id)
          )
        : null;

      const logical = files.reduce(
        (acc: number, f: FileInfo) =>
          acc +
          (f.chunks?.reduce((a: number, c: Chunk) => a + (c.size ?? 0), 0) ??
            0),
        0
      );
      const physical = files.reduce((acc: number, f: FileInfo) => {
        const fileSum = (f.chunks ?? []).reduce((a: number, c: Chunk) => {
          const size = c.size ?? 0;
          if (aliveSet) {
            const aliveReplicas = (c.workers ?? []).filter((id) =>
              aliveSet.has(id)
            ).length;
            return a + size * aliveReplicas;
          }
          return a + size * (c.workers?.length ?? 0);
        }, 0);
        return acc + fileSum;
      }, 0);

      bufferRef.current.push({ t: Date.now(), logical, physical });
      while (bufferRef.current.length > maxSamples) bufferRef.current.shift();
      bump((n) => n + 1);
    }

    return;
  }, [data, maxSamples]);

  // on mount, trigger subscribe message
  useEffect(() => {
    if (send) send({ type: "dashboard:subscribe" });
  }, [send]);

  return {
    data: bufferRef.current.slice(),
    status,
    send,
    raw: data,
  } as {
    data: UsagePoint[];
    status: Status;
    send: (p: unknown) => boolean;
    raw: WsMessage | null;
  };
}
