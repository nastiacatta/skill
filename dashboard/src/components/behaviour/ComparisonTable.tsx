import { useState, useMemo, useCallback } from 'react';
import { fmt } from '@/components/lab/shared';

interface ComparisonRow {
  name: string;
  family: string;
  meanCrps: number;
  deltaCrpsPct: number;
  gini: number;
  nEff: number;
  participation: number;
  color: string;
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
  baselineName?: string;
  defaultSortKey?: keyof ComparisonRow;
  onRowClick?: (name: string) => void;
}

type SortDir = 'asc' | 'desc';

const COLUMNS: { key: keyof ComparisonRow; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Behaviour', numeric: false },
  { key: 'family', label: 'Family', numeric: false },
  { key: 'meanCrps', label: 'Mean CRPS', numeric: true },
  { key: 'deltaCrpsPct', label: 'Δ CRPS %', numeric: true },
  { key: 'gini', label: 'Gini', numeric: true },
  { key: 'nEff', label: 'N_eff', numeric: true },
  { key: 'participation', label: 'Participation', numeric: true },
];

function deltaColor(v: number): string {
  if (v < -1) return 'text-emerald-600';
  if (v > 1) return 'text-red-600';
  return 'text-slate-500';
}

export default function ComparisonTable({
  rows,
  baselineName = 'baseline',
  defaultSortKey = 'deltaCrpsPct',
  onRowClick,
}: ComparisonTableProps) {
  const [sortKey, setSortKey] = useState<keyof ComparisonRow>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = useCallback(
    (key: keyof ComparisonRow) => {
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer select-none px-3 py-2 text-left font-semibold text-slate-500 hover:text-slate-800"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const isBaseline = row.name === baselineName;
            return (
              <tr
                key={row.name}
                onClick={() => onRowClick?.(row.name)}
                className={`border-b border-slate-50 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
                } ${isBaseline ? 'bg-blue-50/30' : ''}`}
              >
                <td className="px-3 py-1.5 font-medium text-slate-700">{row.name}</td>
                <td className="px-3 py-1.5 capitalize text-slate-500">{row.family}</td>
                <td className="px-3 py-1.5 font-mono">{fmt(row.meanCrps)}</td>
                <td className={`px-3 py-1.5 font-mono font-semibold ${deltaColor(row.deltaCrpsPct)}`}>
                  {row.deltaCrpsPct > 0 ? '+' : ''}
                  {fmt(row.deltaCrpsPct, 1)}%
                </td>
                <td className="px-3 py-1.5 font-mono">{fmt(row.gini)}</td>
                <td className="px-3 py-1.5 font-mono">{fmt(row.nEff, 1)}</td>
                <td className="px-3 py-1.5 font-mono">{fmt(row.participation * 100, 1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
