"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import clsx from "clsx";

interface DataGridProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  onRowClick?: (row: T) => void;
  filtroPlaceholder?: string;
  vuoto?: string;
}

// Tabella in stile "foglio di calcolo": intestazione fissa, righe con bordi,
// ordinamento per colonna e filtro testuale globale. Click su una riga apre
// il form di modifica (con conferma) nel componente chiamante.
export function DataGrid<T>({
  columns,
  data,
  onRowClick,
  filtroPlaceholder = "Cerca...",
  vuoto = "Nessun dato presente",
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filtroGlobale, setFiltroGlobale] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filtroGlobale },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltroGlobale,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 bg-white px-3 py-2">
        <input
          value={filtroGlobale}
          onChange={(e) => setFiltroGlobale(e.target.value)}
          placeholder={filtroPlaceholder}
          className="w-72 border border-ink-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
        />
        <span className="text-xs uppercase tracking-wide text-ink-500">{table.getRowModel().rows.length} righe</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none whitespace-nowrap border-b-2 border-ink-900 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-900"
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? ""}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="border-b border-ink-200 px-3 py-6 text-center text-ink-400">
                  {vuoto}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className="cursor-pointer bg-white transition-colors hover:bg-brand-50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap border-b border-ink-200 px-3 py-1.5 text-ink-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
