import { useEffect, useState } from 'react';
import SlideWrapper from './SlideWrapper';

/* ── Interfaces ─────────────────────────────────────────────── */

interface ResultsSlideProps {
  title: string;
  dataPath: string;
}

interface ComparisonRow {
  method: string;
  mean_crps: number;
  delta_crps_vs_equal: number;
}

interface ComparisonData {
  config: {
    T: number;
    n_forecasters: number;
    warmup: number;
    series_name: string;
    forecasters: string[];
  };
  rows: ComparisonRow[];
  per_round: unknown[];
}

/* ── Helpers ────────────────────────────────────────────────── */

const METHOD_LABELS: Record<string, string> = {
  uniform: 'Equal (Uniform)',
  skill: 'Skill Only',
  mechanism: 'Mechanism (Skill + Stake)',
  best_single: 'Best Single Forecaster',
};

const METHOD_COLORS: Record<string, string> = {
  uniform: 'bg-slate-500',
  skill: 'bg-indigo-500',
  mechanism: 'bg-teal-500',
  best_single: 'bg-violet-500',
};

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

function formatCrps(value: number): string {
  return value.toFixed(6);
}

function formatDelta(value: number): string {
  if (value === 0) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(6)}`;
}

function deltaColor(value: number): string {
  if (value === 0) return 'text-slate-400';
  return value < 0 ? 'text-emerald-600 font-semibold' : 'text-slate-600';
}

function isValidComparisonData(json: unknown): json is ComparisonData {
  if (typeof json !== 'object' || json === null) return false;
  const obj = json as Record<string, unknown>;
  return (
    Array.isArray(obj.rows) &&
    obj.rows.every(
      (r: unknown) =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as ComparisonRow).method === 'string' &&
        typeof (r as ComparisonRow).mean_crps === 'number' &&
        typeof (r as ComparisonRow).delta_crps_vs_equal === 'number',
    )
  );
}

/* ── Component ──────────────────────────────────────────────── */

export default function ResultsSlide({ title, dataPath }: ResultsSlideProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(dataPath, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        return res.json();
      })
      .then((json: unknown) => {
        if (!isValidComparisonData(json)) {
          throw new Error('Unexpected data format');
        }
        setData(json);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load results');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [dataPath]);

  const bestMethod = data
    ? data.rows.reduce((best, row) => (row.mean_crps < best.mean_crps ? row : best), data.rows[0])
    : null;

  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Results</h2>
      <h3 className="text-2xl font-bold text-slate-900">{title}</h3>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading results…
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {error}
        </p>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.rows.map((row) => {
              const isBest = row === bestMethod;
              return (
                <div
                  key={row.method}
                  className={`rounded-xl border p-4 ${isBest ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${METHOD_COLORS[row.method] ?? 'bg-slate-400'}`} />
                    <p className="text-[11px] font-medium text-slate-500 truncate">{methodLabel(row.method)}</p>
                  </div>
                  <p className={`text-lg font-bold ${isBest ? 'text-teal-700' : 'text-slate-800'}`}>
                    {row.mean_crps.toFixed(4)}
                  </p>
                  {isBest && (
                    <span className="mt-1 inline-block text-[10px] font-semibold text-teal-600">
                      Lowest CRPS
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed table */}
          <div className="mt-6 rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Mean CRPS</th>
                  <th className="px-5 py-3 text-right">Δ vs Equal</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.method}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${METHOD_COLORS[row.method] ?? 'bg-slate-400'}`} />
                        {methodLabel(row.method)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm text-slate-700">
                      {formatCrps(row.mean_crps)}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono text-sm ${deltaColor(row.delta_crps_vs_equal)}`}>
                      {formatDelta(row.delta_crps_vs_equal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SlideWrapper>
  );
}
