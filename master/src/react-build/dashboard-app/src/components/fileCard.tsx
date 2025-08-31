// src/components/cards/FileCard.tsx
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import type { FileInfo } from "../types/cluster";

const PAGE_SIZE = 6;

export default function FileCard({ file }: { file: FileInfo }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(file.chunks.length / PAGE_SIZE);

  const pageChunks = useMemo(
    () => file.chunks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [file.chunks, page]
  );

  return (
    <motion.div
      layout
      className="p-5 bg-gray-900/70 rounded-2xl border border-gray-800 shadow-lg text-gray-100"
    >
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-lg text-green-400">
          {file.filename}
        </h3>
        <div className="text-xs text-gray-400">
          Chunks: {file.chunks.length}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {pageChunks.map((c) => (
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
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-300">
          <div>
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 rounded bg-gray-800/60 hover:bg-gray-800/80"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1 rounded bg-gray-800/60 hover:bg-gray-800/80"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
