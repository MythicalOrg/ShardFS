
import { motion } from "framer-motion";
import type { FileInfo } from "../types/cluster";

export default function FileCard({ file }: { file: FileInfo }) {
  return (
    <motion.div
      layout
      className="p-5 bg-gray-900/70 rounded-2xl border border-gray-800 shadow-lg text-gray-100"
    >
      <h3 className="font-semibold text-lg text-green-400">{file.filename}</h3>
      <div className="mt-3 space-y-2">
        {file.chunks.map((c) => (
          <div
            key={c.id}
            className="text-sm bg-gray-800/70 p-2 rounded flex justify-between items-center"
          >
            <span>
              Chunk {c.id} • {(c.size / 1024).toFixed(1)} KB
            </span>
            <span className="text-xs text-gray-400">
              Replicas:{" "}
              <span className="text-blue-400 font-medium">
                {c.workers.length}
              </span>{" "}
              ({c.workers.join(", ")})
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
