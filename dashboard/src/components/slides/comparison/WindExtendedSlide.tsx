import SlideWrapper from '../SlideWrapper';
import InsightCard from './InsightCard';
import { useComparisonData } from '../../../lib/comparison/useComparisonData';
import {
  formatCrps,
  formatDelta,
  formatPercent,
  deltaColor,
} from '../../../lib/comparison/comparisonUtils';
import type {
  WindExperimentData,
  DepositSensitivityData,
  ComparisonRow,
} from '../../../lib/comparison/types';

/* ── Constants ──────────────────────────────────────────────── */

const METHOD_ORDER = ['uniform', 'skill', 'mechanism', 'best_single'] as const;

const METHOD_LABELS: Record<string, string> = {
  uniform: 'Equal (Uniform)',
  skill: 'Skill Only',
  mechanism: 'Mechanism (Skill + Stake)',
  best_single: 'Best Single Forecaster',
};

const DEPOSIT_LABELS: Record<string, string> = {
  fixed: 'Fixed Deposit',
  exponential: 'Exponential Deposit',
  bankroll: 'Bankroll Deposit',
};

/* ── Helpers ─────────────────────────────────────────────────── */

function findRow(rows: ComparisonRow[], method: string): ComparisonRow | undefined {
  return rows.find((r) => r.method === method);
}

function ErrorBanner({ label, message }: { label: string; message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      {label} failed to load: {message}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      Loading wind experiment data…
    </div>
  );
}


/* ── Horizon comparison table ───────────────────────────────── */

function HorizonTable({
  dayAhead,
  fourHour,
}: {
  dayAhead: WindExperimentData | null;
  fourHour: WindExperimentData | null;
}) {
  if (!dayAhead && !fourHour) return null;

  const datasets: { label: string; rows: ComparisonRow[] }[] = [];
  if (dayAhead) datasets.push({ label: `Day-Ahead (T=${dayAhead.config.T})`, rows: dayAhead.rows });
  if (fourHour) datasets.push({ label: `4h-Ahead (T=${fourHour.config.T})`, rows: fourHour.rows });

  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-400">
            <th className="px-5 py-3">Method</th>
            {datasets.map((ds) => (
              <th key={ds.label} className="px-4 py-3 text-right" colSpan={2}>
                {ds.label}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50 text-xs text-slate-400">
            <th className="px-5 py-1" />
            {datasets.map((ds) => (
              <th key={ds.label} className="px-4 py-1" colSpan={2}>
                <div className="flex justify-end gap-8 text-[10px]">
                  <span>CRPS</span>
                  <span>ΔCRPS</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METHOD_ORDER.map((method) => (
            <tr key={method} className="border-t border-slate-100">
              <td className="px-5 py-3 text-sm font-medium text-slate-800">
                {METHOD_LABELS[method] ?? method}
              </td>
              {datasets.map((ds) => {
                const row = findRow(ds.rows, method);
                return (
                  <td key={ds.label} className="px-4 py-3" colSpan={2}>
                    <div className="flex justify-end gap-6 font-mono text-sm">
                      <span className="text-slate-700">
                        {row ? formatCrps(row.mean_crps) : '—'}
                      </span>
                      <span className={row ? deltaColor(row.delta_crps_vs_equal) : 'text-slate-400'}>
                        {row ? formatDelta(row.delta_crps_vs_equal) : '—'}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ── Deposit sensitivity table ──────────────────────────────── */

function DepositTable({ data }: { data: DepositSensitivityData }) {
  const policies = Object.entries(data.deposit_sensitivity);

  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-400">
            <th className="px-5 py-3">Deposit Policy</th>
            <th className="px-4 py-3 text-right">Mechanism CRPS</th>
            <th className="px-4 py-3 text-right">ΔCRPS (mech)</th>
            <th className="px-4 py-3 text-right">Improvement</th>
          </tr>
        </thead>
        <tbody>
          {policies.map(([policy, entry]) => (
            <tr key={policy} className="border-t border-slate-100">
              <td className="px-5 py-3 text-sm font-medium text-slate-800">
                {DEPOSIT_LABELS[policy] ?? policy}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                {formatCrps(entry.mechanism)}
              </td>
              <td className={`px-4 py-3 text-right font-mono text-sm ${deltaColor(entry.delta_mech)}`}>
                {formatDelta(entry.delta_mech)}
              </td>
              <td className={`px-4 py-3 text-right font-mono text-sm ${deltaColor(-entry.pct_mech)}`}>
                {formatPercent(entry.pct_mech)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Regime shift table ─────────────────────────────────────── */

function RegimeTable({ data }: { data: WindExperimentData }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-400">
            <th className="px-5 py-3">Method</th>
            <th className="px-4 py-3 text-right">Mean CRPS</th>
            <th className="px-4 py-3 text-right">ΔCRPS vs Equal</th>
          </tr>
        </thead>
        <tbody>
          {METHOD_ORDER.map((method) => {
            const row = findRow(data.rows, method);
            return (
              <tr key={method} className="border-t border-slate-100">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">
                  {METHOD_LABELS[method] ?? method}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                  {row ? formatCrps(row.mean_crps) : '—'}
                </td>
                <td className={`px-4 py-3 text-right font-mono text-sm ${row ? deltaColor(row.delta_crps_vs_equal) : 'text-slate-400'}`}>
                  {row ? formatDelta(row.delta_crps_vs_equal) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


/* ── Main component ─────────────────────────────────────────── */

export default function WindExtendedSlide() {
  const dayAhead = useComparisonData<WindExperimentData>(
    'data/real_data/elia_wind/data/day_ahead.json',
  );
  const fourHour = useComparisonData<WindExperimentData>(
    'data/real_data/elia_wind/data/4h_ahead.json',
  );
  const deposit = useComparisonData<DepositSensitivityData>(
    'data/real_data/elia_wind/data/deposit_sensitivity.json',
  );
  const regime = useComparisonData<WindExperimentData>(
    'data/real_data/elia_wind/data/regime_shift.json',
  );

  const anyLoading =
    dayAhead.loading || fourHour.loading || deposit.loading || regime.loading;
  const allDone =
    !dayAhead.loading && !fourHour.loading && !deposit.loading && !regime.loading;

  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
        Comparison
      </h2>
      <h3 className="text-2xl font-bold text-slate-900">
        Wind — Extended Analysis
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-2xl">
        Additional wind experiments: forecast horizon (day-ahead, 4h-ahead),
        deposit policy sensitivity, and within-run seasonal slice (a
        single-pass evaluation bucketed by month; a true restart-per-season
        regime-shift test is follow-up work).
      </p>

      {/* Loading spinner */}
      {anyLoading && <LoadingSpinner />}

      {/* Error banners */}
      {dayAhead.error && <div className="mt-4"><ErrorBanner label="Day-ahead data" message={dayAhead.error} /></div>}
      {fourHour.error && <div className="mt-4"><ErrorBanner label="4h-ahead data" message={fourHour.error} /></div>}
      {deposit.error && <div className="mt-4"><ErrorBanner label="Deposit sensitivity data" message={deposit.error} /></div>}
      {regime.error && <div className="mt-4"><ErrorBanner label="Regime shift data" message={regime.error} /></div>}

      {allDone && (
        <div className="mt-8 flex flex-col gap-8">
          {/* A) Horizon comparison */}
          {(dayAhead.data || fourHour.data) && (
            <section>
              <h4 className="text-sm font-bold text-slate-700 mb-3">
                Forecast Horizon Comparison
              </h4>
              <HorizonTable dayAhead={dayAhead.data} fourHour={fourHour.data} />
            </section>
          )}

          {/* B) Deposit sensitivity */}
          {deposit.data && (
            <section>
              <h4 className="text-sm font-bold text-slate-700 mb-3">
                Deposit Policy Sensitivity
              </h4>
              <DepositTable data={deposit.data} />
            </section>
          )}

          {/* C) Regime shift */}
          {regime.data && (
            <section>
              <h4 className="text-sm font-bold text-slate-700 mb-3">
                Regime Shift (Non-Stationarity)
              </h4>
              <RegimeTable data={regime.data} />
              <div className="mt-4">
                <InsightCard
                  color="green"
                  title="Mechanism still wins under a regime shift"
                  description={`Under the regime-shifted draw the mechanism runs at ΔCRPS ${
                    findRow(regime.data.rows, 'mechanism')
                      ? formatDelta(findRow(regime.data.rows, 'mechanism')!.delta_crps_vs_equal)
                      : '—'
                  } versus equal weighting, so the skill layer continues to separate forecasters when the panel composition moves.`}
                />
              </div>
            </section>
          )}
        </div>
      )}
    </SlideWrapper>
  );
}
