// src/pages/Dashboard.tsx
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useWebSocket } from "../hooks/useWebSocket";
import WorkerCard from "../components/workerCard";
import FileCard from "../components/fileCard";
import type { Worker, FileInfo } from "../types/cluster";

const fmtBytes = (n: number) => {
  if (n <= 0 || Number.isNaN(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log2(n) / 10);
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};

export default function Dashboard() {

  const host = window.location.host;
  const Master_URL = `ws://${host}/ws`;

  const { data, status } = useWebSocket(Master_URL);

  let workers: Worker[] = [];
  let files: FileInfo[] = [];

  if (data?.type === "cluster:update" || data?.type === "cluster:snapshot") {
    workers = data.data.workers ?? [];
    files = data.data.files ?? [];
  } else if (data?.type === "workers:list") {
    workers = data.data ?? [];
  }

  // Compute cluster totals from files (robust)
  const { totalChunks, logicalBytes, physicalBytes, perWorkerStats } =
    useMemo(() => {
      const workerStats = new Map<string, { chunks: number; bytes: number }>();
      let chunks = 0;
      let logical = 0;
      let physical = 0;

      for (const f of files) {
        for (const c of f.chunks) {
          chunks += 1;
          logical += c.size;
          physical += c.size * (c.workers?.length ?? 0);
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
    }, [files]);

  // Alive vs dead counts
  const aliveCount = workers.filter((w) => w.status === "alive").length;
  const deadCount = workers.filter((w) => w.status === "dead").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-black p-8 text-gray-100">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
          ShardFS Cluster Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time monitoring of workers & files
        </p>
      </header>

      {/* Cluster Stats */}
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

      {/* Storage View */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <StatCard title="Physical Stored (with replication)">
          <div className="text-2xl font-bold">{fmtBytes(physicalBytes)}</div>
          <p className="text-xs text-gray-400 mt-1">
            Sum of chunk sizes × replicas (actual cluster usage)
          </p>
        </StatCard>
        <StatCard title="Average Replication Factor">
          <div className="text-2xl font-bold">
            {logicalBytes > 0 ? (physicalBytes / logicalBytes).toFixed(2) : "—"}
          </div>
          <p className="text-xs text-gray-400 mt-1">physical / logical</p>
        </StatCard>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workers */}
        <section className="bg-gray-950/60 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-800">
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

        {/* Files */}
        <section className="bg-gray-950/60 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-800">
          <h2 className="text-2xl font-semibold mb-4 text-green-400">
            Stored Files
          </h2>
          {files.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1">
              {files.map((f) => (
                <FileCard key={f.filename} file={f} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No files stored yet.</p>
          )}
        </section>
      </div>

      {/* Connection Status */}
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
      className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 text-center"
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
      className="p-5 rounded-2xl bg-gray-900/70 border border-gray-800"
    >
      <h3 className="font-semibold text-lg text-gray-200 mb-2">{title}</h3>
      {children}
    </motion.div>
  );
}
