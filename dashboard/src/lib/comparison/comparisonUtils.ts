import type { ComparisonRow, AggregatedRow } from './types';

// ── Aggregation ────────────────────────────────────────────

/** Group DGP rows by method, compute arithmetic mean of mean_crps and delta_crps_vs_equal */
export function aggregateByMethod(rows: ComparisonRow[]): AggregatedRow[] {
  const groups = new Map<string, ComparisonRow[]>();

  for (const row of rows) {
    const existing = groups.get(row.method);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(row.method, [row]);
    }
  }

  const result: AggregatedRow[] = [];
  for (const [method, methodRows] of groups) {
    const n = methodRows.length;
    const meanCrps = methodRows.reduce((sum, r) => sum + r.mean_crps, 0) / n;
    const meanDelta = methodRows.reduce((sum, r) => sum + r.delta_crps_vs_equal, 0) / n;
    result.push({ method, meanCrps, meanDelta, seedCount: n });
  }

  return result;
}

// ── Formatting ─────────────────────────────────────────────

/** Format CRPS to 6 decimal places */
export function formatCrps(value: number): string {
  return value.toFixed(6);
}

/** Format ΔCRPS with sign prefix; returns "—" for zero */
export function formatDelta(value: number): string {
  if (value === 0) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(6)}`;
}

/** Format percentage to 1 decimal place with % suffix */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Return Tailwind color class for delta: green for negative, red for positive, slate for zero */
export function deltaColor(value: number): string {
  if (value === 0) return 'text-slate-400';
  return value < 0 ? 'text-emerald-600 font-semibold' : 'text-red-500';
}

// ── Computation ────────────────────────────────────────────

/** Compute percentage improvement: (uniformCrps - methodCrps) / uniformCrps * 100 */
export function computeImprovement(uniformCrps: number, methodCrps: number): number {
  if (uniformCrps === 0) return 0;
  return ((uniformCrps - methodCrps) / uniformCrps) * 100;
}

/** Return the entry with the lowest meanCrps from a non-empty array */
export function findBestMethod(rows: { method: string; meanCrps: number }[]): { method: string; meanCrps: number } {
  return rows.reduce((best, row) => (row.meanCrps < best.meanCrps ? row : best), rows[0]);
}
