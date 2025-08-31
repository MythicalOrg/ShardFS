// src/components/tables/FilesTable.tsx
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import type { FileInfo } from "../../types/cluster";

export default function FilesTable({ files }: { files: FileInfo[] }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;

  const columns: ColumnDef<FileInfo>[] = [
    { accessorKey: "filename", header: "Filename" },
    { accessorFn: (row) => row.chunks.length, header: "Chunks" },
    {
      accessorFn: (row) =>
        (row.chunks.reduce((a, c) => a + c.size, 0) / 1024).toFixed(1) + " KB",
      header: "Size",
    },
  ];

  const table = useReactTable({
    data: files.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-2xl bg-gray-900/70 border border-gray-800 p-4">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="text-left p-2 text-gray-400">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="border-t border-gray-800">
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="p-2">
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="mt-3 flex justify-between text-xs text-gray-400">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="px-2 py-1 bg-gray-800/60 rounded disabled:opacity-40"
        >
          Prev
        </button>
        <span>
          Page {page + 1} / {Math.ceil(files.length / PAGE_SIZE)}
        </span>
        <button
          disabled={(page + 1) * PAGE_SIZE >= files.length}
          onClick={() => setPage((p) => p + 1)}
          className="px-2 py-1 bg-gray-800/60 rounded disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
