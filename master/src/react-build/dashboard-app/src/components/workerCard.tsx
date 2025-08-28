
import { motion } from "framer-motion";
import type { Worker } from "../types/cluster";

const fmtBytes = (n: number) => {
  if (n <= 0 || Number.isNaN(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log2(n) / 10);
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};

export default function WorkerCard({ worker }: { worker: Worker }) {
  const used = Math.max(0, worker.totalBytes - worker.freeBytes);
  const percent = worker.totalBytes ? (used / worker.totalBytes) * 100 : 0;

  const chunks = worker.metadata?.totalChunks ?? 0;
  const bytesStored = worker.metadata?.totalSize ?? 0;
  const hostLabel = worker.metadata?.hostname ?? worker.host;

  const alive = worker.status === "alive";

  return (
    <motion.div
      layout
      className="p-5 rounded-2xl bg-gray-900/70 border border-gray-800 shadow-lg text-gray-100"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-blue-400">Worker {worker.id}</h3>

        {/* Status pill */}
        <span
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            alive
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400 animate-pulse"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              alive ? "bg-green-400" : "bg-red-400"
            }`}
          />
          {alive ? "Alive" : "Dead"}
        </span>
      </div>

      <p className="text-xs text-gray-400">{hostLabel}</p>

      {/* Storage Usage */}
      <div className="mt-4">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              alive
                ? "bg-gradient-to-r from-green-400 to-blue-500"
                : "bg-gradient-to-r from-red-500 to-red-700"
            }`}
            style={{ width: `${percent.toFixed(1)}%` }}
          />
        </div>
        <div className="text-xs mt-1 text-gray-400">
          {fmtBytes(used)} used / {fmtBytes(worker.totalBytes)} total
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-300">
        <div className="bg-gray-800/70 rounded p-2">
          <span className="block font-semibold text-sm text-green-400">
            {chunks}
          </span>
          chunks
        </div>
        <div className="bg-gray-800/70 rounded p-2">
          <span className="block font-semibold text-sm text-blue-400">
            {fmtBytes(bytesStored)}
          </span>
          stored
        </div>
      </div>
    </motion.div>
  );
}
