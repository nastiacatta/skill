/**
 * EnhancedComparisonTable — grouped, filterable, searchable comparison view.
 *
 * Replaces the flat ComparisonTable with:
 *   - Family filter bar (toggle chips)
 *   - Text search (name, family, presetId)
 *   - Rows grouped by BehaviourFamily with collapsible headers
 *   - Colour-coded delta bars proportional to |deltaCrpsPct|
 *   - Baseline row highlighting
 *   - Sort-by-column (preserved from ComparisonTable)
 *   - onRowClick callback for tab navigation
 */

import { useState, useMemo, useCallback } from 'react';
import { fmt } from '@/components/lab/shared';
import { FAMILY_COLORS } from '@/lib/palette';
import type { ComparisonRow } from '@/hooks/useBehaviourSimulations';
import type { BehaviourFamily, BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';
import { PLAIN_EXPLANATION } from '@/components/behaviour/PresetCallout';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EnhancedComparisonTableProps {
  rows: ComparisonRow[];
  baselineName?: string;
  onRowClick?: (presetId: string) => void;
  grouped?: boolean;
}

type SortDir = 'asc' | 'desc';
type SortKey = keyof ComparisonRow;

// ── Columns ────────────────────────────────────────────────────────────────

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Behaviour', numeric: false },
  { key: 'family', label: 'Family', numeric: false },
  { key: 'meanCrps', label: 'Mean CRPS', numeric: true },
  { key: 'deltaCrpsPct', label: 'Δ CRPS %', numeric: true },
  { key: 'gini', label: 'Gini', numeric: true },
  { key: 'nEff', label: 'N_eff', numeric: true },
  { key: 'participation', label: 'Participation', numeric: true },
];

// ── All families in display order ──────────────────────────────────────────

const ALL_FAMILIES: BehaviourFamily[] = [
  'participation', 'information', 'reporting', 'staking', 'objectives',
  'identity', 'learning', 'adversarial', 'operational',
];

// ── Core algorithm (exported for testing) ──────────────────────────────────

/**
 * Filter, sort, and group comparison rows.
 *
 * Preconditions:
 *   - rows is a valid array (may be empty)
 *   - activeFilters contains only valid BehaviourFamily values
 *   - sortKey is a valid key of ComparisonRow
 *
 * Postconditions:
 *   - total rows across all groups = rows matching filters + search
 *   - each row appears in exactly one group
 *   - rows within each group sorted by sortKey/sortDir
 */
export function groupAndFilterRows(
  rows: ComparisonRow[],
  activeFilters: BehaviourFamily[],
  searchQuery: string,
  sortKey: SortKey,
  sortDir: SortDir,
): Map<BehaviourFamily, ComparisonRow[]> {
  // Step 1: Apply family filter
  let filtered = rows;
  if (activeFilters.length > 0) {
    filtered = rows.filter(r => activeFilters.includes(r.family as BehaviourFamily));
  }

  // Step 2: Apply text search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.family.toLowerCase().includes(q) ||
        r.presetId.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }

  // Step 3: Sort
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Step 4: Group by family
  const grouped = new Map<BehaviourFamily, ComparisonRow[]>();
  for (const row of sorted) {
    const family = row.family as BehaviourFamily;
    const list = grouped.get(family) ?? [];
    list.push(row);
    grouped.set(family, list);
  }

  return grouped;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deltaColor(v: number): string {
  if (v < -1) return 'text-emerald-600';
  if (v > 1) return 'text-red-600';
  return 'text-slate-500';
}

import { PALETTE } from '@/lib/palette';

function deltaBarColor(v: number): string {
  if (v < -1) return PALETTE.teal;   // improvement
  if (v > 1) return PALETTE.coral;   // regression
  return PALETTE.slate;              // neutral
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EnhancedComparisonTable({
  rows,
  baselineName = 'Benign baseline',
  onRowClick,
  grouped = true,
}: EnhancedComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('deltaCrpsPct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeFilters, setActiveFilters] = useState<BehaviourFamily[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<BehaviourFamily>>(new Set());

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const toggleFilter = useCallback((family: BehaviourFamily) => {
    setActiveFilters(prev =>
      prev.includes(family) ? prev.filter(f => f !== family) : [...prev, family],
    );
  }, []);

  const toggleCollapse = useCallback((family: BehaviourFamily) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  }, []);

  // Compute max |delta| for bar scaling
  const maxAbsDelta = useMemo(
    () => Math.max(1, ...rows.map(r => Math.abs(r.deltaCrpsPct))),
    [rows],
  );

  const groupedRows = useMemo(
    () => groupAndFilterRows(rows, activeFilters, searchQuery, sortKey, sortDir),
    [rows, activeFilters, searchQuery, sortKey, sortDir],
  );

  // Determine family order for rendering
  const familyOrder = useMemo(() => {
    if (grouped) {
      return ALL_FAMILIES.filter(f => groupedRows.has(f));
    }
    return ['__flat__'] as unknown as BehaviourFamily[];
  }, [grouped, groupedRows]);

  // Flat sorted list for non-grouped mode
  const flatRows = useMemo(() => {
    if (grouped) return [];
    const all: ComparisonRow[] = [];
    for (const rows of groupedRows.values()) all.push(...rows);
    return all;
  }, [grouped, groupedRows]);

  // Unique families present in data (for filter chips)
  const presentFamilies = useMemo(() => {
    const families = new Set<BehaviourFamily>();
    for (const row of rows) families.add(row.family as BehaviourFamily);
    return ALL_FAMILIES.filter(f => families.has(f));
  }, [rows]);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {presentFamilies.map(family => {
          const isActive = activeFilters.includes(family);
          const color = FAMILY_COLORS[family] ?? PALETTE.slate;
          return (
            <button
              key={family}
              onClick={() => toggleFilter(family)}
              className={`px-2.5 py-1 rounded-full text-[13px] font-medium border transition-colors capitalize ${
                isActive
                  ? 'text-white border-transparent'
                  : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50'
              }`}
              style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
            >
              {family}
            </button>
          );
        })}
        {activeFilters.length > 0 && (
          <button
            onClick={() => setActiveFilters([])}
            className="px-2 py-1 rounded-full text-[13px] text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, family, or preset…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full max-w-sm px-3 py-1.5 text-[14px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {COLUMNS.map(col => (
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
            {grouped
              ? familyOrder.map(family => {
                  const familyRows = groupedRows.get(family) ?? [];
                  const isCollapsed = collapsedFamilies.has(family);
                  const color = FAMILY_COLORS[family] ?? PALETTE.slate;
                  return (
                    <GroupSection
                      key={family}
                      family={family}
                      rows={familyRows}
                      color={color}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleCollapse(family)}
                      baselineName={baselineName}
                      onRowClick={onRowClick}
                      maxAbsDelta={maxAbsDelta}
                    />
                  );
                })
              : flatRows.map(row => (
                  <DataRow
                    key={row.presetId}
                    row={row}
                    baselineName={baselineName}
                    onRowClick={onRowClick}
                    maxAbsDelta={maxAbsDelta}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Group section (collapsible family header + rows) ───────────────────────

function GroupSection({
  family,
  rows,
  color,
  isCollapsed,
  onToggle,
  baselineName,
  onRowClick,
  maxAbsDelta,
}: {
  family: BehaviourFamily;
  rows: ComparisonRow[];
  color: string;
  isCollapsed: boolean;
  onToggle: () => void;
  baselineName: string;
  onRowClick?: (presetId: string) => void;
  maxAbsDelta: number;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer bg-slate-50/40 hover:bg-slate-100/60 border-b border-slate-100"
      >
        <td colSpan={7} className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-slate-400">{isCollapsed ? '▶' : '▼'}</span>
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="font-semibold text-slate-700 capitalize">{family}</span>
            <span className="text-slate-400 text-[13px]">({rows.length})</span>
          </div>
        </td>
      </tr>
      {!isCollapsed &&
        rows.map(row => (
          <DataRow
            key={row.presetId}
            row={row}
            baselineName={baselineName}
            onRowClick={onRowClick}
            maxAbsDelta={maxAbsDelta}
          />
        ))}
    </>
  );
}

// ── Single data row ────────────────────────────────────────────────────────

function DataRow({
  row,
  baselineName,
  onRowClick,
  maxAbsDelta,
}: {
  row: ComparisonRow;
  baselineName: string;
  onRowClick?: (presetId: string) => void;
  maxAbsDelta: number;
}) {
  const isBaseline = row.name === baselineName;
  const barWidth = maxAbsDelta > 0 ? (Math.abs(row.deltaCrpsPct) / maxAbsDelta) * 100 : 0;
  const explanation =
    PLAIN_EXPLANATION[row.presetId as BehaviourPresetId] ?? row.description ?? '';

  return (
    <tr
      onClick={() => onRowClick?.(row.presetId)}
      className={`border-b border-slate-50 transition-colors ${
        onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
      } ${isBaseline ? 'bg-blue-50/30' : ''}`}
    >
      <td className="px-3 py-2 align-top">
        <div className="font-medium text-slate-700">{row.name}</div>
        {explanation && (
          <div className="text-[13px] text-slate-500 mt-0.5 max-w-[340px] leading-snug">
            {explanation}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top capitalize text-slate-500">{row.family}</td>
      <td className="px-3 py-2 align-top font-mono">{fmt(row.meanCrps)}</td>
      <td className={`px-3 py-2 align-top font-mono font-semibold ${deltaColor(row.deltaCrpsPct)}`}>
        <div className="flex items-center gap-1.5">
          <span className="shrink-0">
            {row.deltaCrpsPct > 0 ? '+' : ''}
            {fmt(row.deltaCrpsPct, 1)}%
          </span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(barWidth, 100)}%`,
                backgroundColor: deltaBarColor(row.deltaCrpsPct),
              }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-2 align-top font-mono">{fmt(row.gini)}</td>
      <td className="px-3 py-2 align-top font-mono">{fmt(row.nEff, 1)}</td>
      <td className="px-3 py-2 align-top font-mono">{fmt(row.participation * 100, 1)}%</td>
    </tr>
  );
}
