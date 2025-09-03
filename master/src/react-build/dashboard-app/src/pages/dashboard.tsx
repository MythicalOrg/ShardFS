// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useClusterWs } from "../hooks/useClusterWs";
import WorkerCard from "../components/workerCard";
import FileCard from "../components/fileCard";
import ClusterUsageChart from "../components/charts/ClusterUsageCharts";
import FilesTable from "../components/tables/FilesTable";
import AlertsProvider from "../components/alert/AlertsProvider";
import { useAlertStore } from "../components/store/alertStore";
import type { Worker, FileInfo } from "../types/cluster";

// ---------------------- helpers ----------------------
const fmtBytes = (n: number) => {
  if (!isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};

function computeAggregates(files: FileInfo[], aliveSet: Set<string>) {
  const workerStats = new Map<string, { chunks: number; bytes: number }>();
  let chunks = 0;
  let logical = 0;
  let physical = 0;

  for (const f of files) {
    for (const c of f.chunks) {
      chunks += 1;
      logical += c.size;

      // include replica size only for alive workers
      const aliveReplicas = (c.workers ?? []).filter((id) =>
        aliveSet.has(id)
      ).length;
      physical += c.size * aliveReplicas;

      for (const wid of c.workers ?? []) {
        const cur = workerStats.get(wid) ?? { chunks: 0, bytes: 0 };
        cur.chunks += 1;
        cur.bytes += c.size;
        workerStats.set(wid, cur);
      }
    }
  }

  return {
    totalChunks: chunks,
    logicalBytes: logical,
    physicalBytes: physical,
    perWorkerStats: workerStats,
  };
}

// ---------------------- small UI helpers ----------------------
function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <motion.div
      layout
      className="p-4 rounded-xl bg-gray-900/70 border border-gray-700 text-center"
    >
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <p className="text-xs text-gray-400">{label}</p>
    </motion.div>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      className="p-5 rounded-2xl bg-gray-900/70 border border-gray-700"
    >
      <h3 className="font-semibold text-lg text-gray-200 mb-2">{title}</h3>
      {children}
    </motion.div>
  );
}

// ---------------------- component ----------------------
export default function Dashboard() {
  // build WS url from current host (works for dev & prod behind proxy)
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const Master_URL = `${protocol}://${window.location.host}/ws`;

  // usage time-series + connection status from the shared hook
  const { data: usageData, status, raw } = useClusterWs(Master_URL, 300);

  // cluster state derived from WS messages
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);

  // keep last known worker statuses to detect transitions
  const lastWorkerMap = useRef<Map<string, Worker>>(new Map());
  // dedupe alerts (avoid spamming repeated high usage alerts)
  const lastAlertMap = useRef<Map<string, number>>(new Map()); // key -> timestamp

  const pushAlert = useAlertStore((s) => s.push);

  // aggregated stats memoized (exclude dead workers from physical bytes)
  const aliveSet = useMemo(
    () => new Set(workers.filter((w) => w.status === "alive").map((w) => w.id)),
    [workers]
  );
  const { totalChunks, logicalBytes, physicalBytes, perWorkerStats } = useMemo(
    () => computeAggregates(files, aliveSet),
    [files, aliveSet]
  );

  const aliveCount = useMemo(
    () => workers.filter((w) => w.status === "alive").length,
    [workers]
  );
  const deadCount = useMemo(
    () => workers.filter((w) => w.status === "dead").length,
    [workers]
  );

  // Evaluate worker alerts (keeps behavior from the original implementation).
  const evaluateWorkerAlerts = React.useCallback(
    (wlist: Worker[]) => {
      const now = Date.now();
      for (const w of wlist) {
        const prev = lastWorkerMap.current.get(w.id);

        // death -> error
        if (prev && prev.status === "alive" && w.status === "dead") {
          const key = `death:${w.id}`;
          const last = lastAlertMap.current.get(key) ?? 0;
          if (now - last > 2 * 60_000) {
            lastAlertMap.current.set(key, now);
            pushAlert({
              title: `Worker ${w.id} went offline`,
              severity: "error",
            });
          }
        }

        // revive -> success
        if (prev && prev.status === "dead" && w.status === "alive") {
          lastAlertMap.current.set(`recovery:${w.id}`, now);
          pushAlert({
            title: `Worker ${w.id} is back online`,
            severity: "success",
          });
        }

        // high disk usage -> warning/error
        if (
          typeof w.totalBytes === "number" &&
          typeof w.freeBytes === "number"
        ) {
          const used = Math.max(0, w.totalBytes - w.freeBytes);
          const percent = w.totalBytes ? (used / w.totalBytes) * 100 : 0;
          const key = `disk:${w.id}`;
          const last = lastAlertMap.current.get(key) ?? 0;

          if (percent >= 95 && now - last > 5 * 60_000) {
            lastAlertMap.current.set(key, now);
            pushAlert({
              title: `Worker ${w.id} disk critical: ${percent.toFixed(0)}%`,
              severity: "error",
            });
          } else if (percent >= 90 && now - last > 10 * 60_000) {
            lastAlertMap.current.set(key, now);
            pushAlert({
              title: `Worker ${w.id} high disk usage: ${percent.toFixed(0)}%`,
              severity: "warning",
            });
          }
        }

        lastWorkerMap.current.set(w.id, w);
      }
    },
    [pushAlert]
  );

  // parse incoming WS messages and update state + run rules
  useEffect(() => {
    if (!raw) return;

    const msg = raw;
    switch (msg.type) {
      case "cluster:snapshot":
      case "cluster:update": {
        const w = msg.data.workers ?? [];
        const f = msg.data.files ?? [];
        setWorkers(w);
        setFiles(f);
        evaluateWorkerAlerts(w);
        break;
      }
      case "workers:list": {
        setWorkers(msg.data ?? []);
        evaluateWorkerAlerts(msg.data ?? []);
        break;
      }
      case "worker:heartbeat": {
        // update single worker in-place to avoid stomping the whole list
        setWorkers((prev) => {
          const idx = prev.findIndex((x) => x.id === msg.data.id);
          if (idx >= 0) {
            const copy = prev.slice();
            copy[idx] = msg.data;
            return copy;
          }
          return [...prev, msg.data];
        });
        evaluateWorkerAlerts([msg.data]);
        break;
      }
      default:
        break;
    }
  }, [raw, evaluateWorkerAlerts]);

  // ---------------------- render ----------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-black p-8 text-gray-100">
      <AlertsProvider />

      <header className="mb-8 text-start">
        <h1 className="text-4xl font-extrabold tracking-tight font-mono">
          ShardFS Cluster Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time monitoring of workers & files
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Stat
          label="Workers (Alive)"
          value={String(aliveCount)}
          accent="text-green-400"
        />
        <Stat
          label="Workers (Dead)"
          value={String(deadCount)}
          accent="text-red-400"
        />
        <Stat
          label="Files"
          value={String(files.length)}
          accent="text-green-400"
        />
        <Stat
          label="Total Chunks"
          value={String(totalChunks)}
          accent="text-yellow-400"
        />
        <Stat
          label="Logical Data"
          value={fmtBytes(logicalBytes)}
          accent="text-purple-400"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="md:col-span-2">
          <StatCard title="Physical Stored (with replication)">
            <div className="text-2xl font-bold">{fmtBytes(physicalBytes)}</div>
            <p className="text-xs text-gray-400 mt-1">
              Sum of chunk sizes × replicas (actual cluster usage)
            </p>
            <div className="mt-4">
              <ClusterUsageChart data={usageData} />
            </div>
          </StatCard>
        </div>

        <div>
          <StatCard title="Average Replication Factor">
            <div className="text-2xl font-bold">
              {logicalBytes > 0
                ? (physicalBytes / logicalBytes).toFixed(2)
                : "—"}
            </div>
            <p className="text-xs text-gray-400 mt-1">physical / logical</p>

            <div className="mt-4">
              <div className="text-sm text-gray-300 mb-2">Recent Alerts</div>
              <div className="space-y-2">
                {useAlertStore
                  .getState()
                  .alerts.slice(0, 6)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="text-xs bg-gray-800/50 p-2 rounded flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-gray-400">
                          {new Date(
                            a.id.split(":")[0] || Date.now()
                          ).toLocaleString()}
                        </div>
                      </div>
                      <div className="ml-2 text-[10px] px-2 py-1 rounded-full bg-gray-700 text-gray-200">
                        {a.severity}
                      </div>
                    </div>
                  ))}
                {useAlertStore.getState().alerts.length === 0 && (
                  <div className="text-xs text-gray-400">No alerts</div>
                )}
              </div>
            </div>
          </StatCard>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-gray-950/60 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400">
            Worker Nodes
          </h2>
          {workers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {workers.map((w) => (
                <WorkerCard
                  key={w.id}
                  worker={{
                    ...w,
                    metadata: {
                      totalChunks:
                        perWorkerStats.get(w.id)?.chunks ??
                        w.metadata?.totalChunks ??
                        0,
                      totalSize:
                        perWorkerStats.get(w.id)?.bytes ??
                        w.metadata?.totalSize ??
                        0,
                      hostname: w.metadata?.hostname ?? w.host,
                    },
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No workers connected.</p>
          )}
        </section>

        <section className="bg-gray-950/60 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4 text-green-400">
            Stored Files
          </h2>
          <div className="mb-6">
            <FilesTable files={files} />
          </div>
          <div className="grid gap-4 sm:grid-cols-1">
            {files.slice(0, 6).map((f) => (
              <FileCard key={f.filename} file={f} />
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-10 text-sm text-gray-500 text-center">
        Connection:{" "}
        <span
          className={`font-medium ${
            status === "open"
              ? "text-green-400"
              : status === "connecting"
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {status}
        </span>
      </footer>
    </div>
  );
}
