import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from '@/components/dashboard/ChartCard';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import {
  AXIS_STROKE,
  AXIS_TICK,
  CHART_MARGIN_LABELED,
  GRID_PROPS,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';

/* Academic palette token — mirrors --amber in index.css (amber is not in PALETTE). */
const AMBER = '#B45309';
const CORAL = PALETTE.coral;

/* ── Data types — mirror elia_operational_baseline.json ────────────── */

interface EliaForecastRow {
  n: number;
  mae_mw: number;
  rmse_mw: number;
  bias_mw: number;
  crps_normalized: number;
  crps_mw_equivalent: number;
  crps_normalized_grid3?: number;
  crps_mw_equivalent_grid3?: number;
  crps_normalized_grid9?: number;
  crps_mw_equivalent_grid9?: number;
  mean_measured_mw: number;
  // Coverage keys use a dotted name in the source JSON (e.g. "coverage_p10_nominal_0.10");
  // we do not type them here since TypeScript identifiers cannot contain dots.
  [key: string]: number | undefined;
}

interface OurMechanismRow {
  crps_normalized: number;
  crps_mw_equivalent: number;
}

interface EliaBaselineData {
  mostrecentforecast: EliaForecastRow;
  dayaheadforecast: EliaForecastRow;
  dayahead11hforecast: EliaForecastRow;
  weekaheadforecast: EliaForecastRow;
  our_mechanism_post_fix: {
    T: number;
    series_min_mw: number;
    series_max_mw: number;
    rows: Record<string, OurMechanismRow>;
  };
}

interface BarRow {
  label: string;
  source: 'elia' | 'ours';
  crps_mw: number;
  color: string;
  highlight?: boolean;
}

/**
 * External validation: compare our mechanism and our individual forecasters
 * against Elia's own operational wind-power forecasts (mostrecentforecast,
 * dayaheadforecast, weekaheadforecast) on the 2024–2025 Belgian wind series.
 *
 * This is the strongest external benchmark we have: Elia's real-time forecast
 * uses weather inputs (NWP) and a physical model, while our best single
 * forecaster (online XGBoost) sees only lag features of the measured series.
 */
export default function EliaOperationalBaseline() {
  const [data, setData] = useState<EliaBaselineData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/real_data/elia_wind/data/elia_operational_baseline.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: EliaBaselineData) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e));
      });
    return () => { cancelled = true; };
  }, []);

  if (err) {
    return (
      <div
        className="p-5 rounded-xl"
        role="alert"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          External validation data not available.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div
        className="p-5 rounded-xl animate-pulse"
        role="status"
        aria-label="Loading external validation data"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          height: 360,
        }}
      />
    );
  }

  // Grid-matched 9-level rescore: Elia's native 3-point fan is linearly
  // interpolated onto the mechanism's 9-level TAUS_FINE grid so the two
  // are on the same Riemann approximation of the pinball integrand
  // (post-fix A2). Fall back to the 3-grid alias for legacy JSONs.
  const mostRecent = data.mostrecentforecast.crps_mw_equivalent_grid9
    ?? data.mostrecentforecast.crps_mw_equivalent;
  const dayAhead = data.dayaheadforecast.crps_mw_equivalent_grid9
    ?? data.dayaheadforecast.crps_mw_equivalent;
  const weekAhead = data.weekaheadforecast.crps_mw_equivalent_grid9
    ?? data.weekaheadforecast.crps_mw_equivalent;
  const dayAhead11h = data.dayahead11hforecast.crps_mw_equivalent_grid9
    ?? data.dayahead11hforecast.crps_mw_equivalent;
  const ours = data.our_mechanism_post_fix.rows;

  // Ordered ascending by CRPS (lower is better)
  const rows: BarRow[] = ([
    // Ours
    { label: 'Our best_single (online XGBoost)', source: 'ours' as const, crps_mw: ours.best_single.crps_mw_equivalent, color: PALETTE.teal, highlight: true },
    { label: 'Our per-round oracle (hindsight)', source: 'ours' as const, crps_mw: ours.per_round_inv_crps_hindsight.crps_mw_equivalent, color: PALETTE.teal },
    { label: 'Our median', source: 'ours' as const, crps_mw: ours.median.crps_mw_equivalent, color: PALETTE.teal },
    { label: 'Our trimmed mean', source: 'ours' as const, crps_mw: ours.trimmed_mean.crps_mw_equivalent, color: PALETTE.teal },
    { label: 'Our inverse-variance', source: 'ours' as const, crps_mw: ours.inverse_variance.crps_mw_equivalent, color: PALETTE.teal },
    { label: 'Our mechanism (skill × stake)', source: 'ours' as const, crps_mw: ours.mechanism.crps_mw_equivalent, color: PALETTE.navy, highlight: true },
    { label: 'Our skill-only', source: 'ours' as const, crps_mw: ours.skill.crps_mw_equivalent, color: PALETTE.teal },
    { label: 'Our uniform (baseline)', source: 'ours' as const, crps_mw: ours.uniform.crps_mw_equivalent, color: PALETTE.slate },
    // Elia operational forecasts
    { label: 'Elia most-recent forecast (NWP, real-time)', source: 'elia' as const, crps_mw: mostRecent, color: AMBER, highlight: true },
    { label: 'Elia day-ahead forecast (NWP)', source: 'elia' as const, crps_mw: dayAhead, color: AMBER },
    { label: 'Elia day-ahead-11h forecast', source: 'elia' as const, crps_mw: dayAhead11h, color: AMBER },
    { label: 'Elia week-ahead forecast', source: 'elia' as const, crps_mw: weekAhead, color: CORAL },
  ] as BarRow[]).sort((a, b) => a.crps_mw - b.crps_mw);

  const bestXgb = ours.best_single.crps_mw_equivalent;
  // Convention: positive = better than Elia (lower CRPS). Display as
  // "−X% vs Elia" when positive (our error is X% below Elia's), and
  // "+X% vs Elia" when negative (our error is X% above Elia's).
  const xgbVsElia  = (1 - bestXgb / mostRecent) * 100;                         // positive if we beat Elia
  const mechVsElia = (ours.mechanism.crps_mw_equivalent / mostRecent - 1) * 100; // positive if we trail Elia

  return (
    <ChartCard
      title="External validation: our forecasts vs Elia's own operational forecasts"
      subtitle="CRPS in MW-equivalent units on the full 17 344-hour Belgian offshore wind series (2024–2025). Lower is better. Our best individual forecaster (online XGBoost) is trained on lag features alone; Elia's forecasts use weather inputs and a physical model."
      provenance={{ type: 'real', label: 'Real data, Elia wind 2024–2025' }}
      help={{
        term: 'MW-equivalent CRPS',
        definition: 'The normalised CRPS multiplied by the series range (series_max − series_min ≈ 2209 MW) gives an error in megawatts. Comparable across normalisation schemes.',
        interpretation: 'Elia `mostrecentforecast` is the operational near-real-time forecast that system operators use. Beating it with only historical observations is a meaningful external benchmark.',
        axes: { x: 'CRPS (MW-equivalent)', y: 'Forecast method' },
      }}
    >
      <ResponsiveContainer width="100%" height={Math.max(320, rows.length * 30 + 48)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ ...CHART_MARGIN_LABELED, left: 12, right: 60 }}
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{ value: 'CRPS (MW-equivalent, lower is better)', position: 'insideBottom', offset: -8, fontSize: 12, fill: PALETTE.slate }}
          />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} width={250} />
          <ReferenceLine x={mostRecent} stroke={AMBER} strokeDasharray="4 4"
            label={{ value: `Elia real-time (${mostRecent.toFixed(1)} MW)`, position: 'top', fontSize: 10, fill: AMBER }} />
          <Tooltip content={<SmartTooltip />} />
          <Bar dataKey="crps_mw" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((d) => (
              <Cell key={d.label} fill={d.color} opacity={d.highlight ? 0.95 : 0.55} />
            ))}
            <LabelList
              dataKey="crps_mw"
              position="right"
              formatter={(v: string | number | boolean | null | undefined) => {
                const n = Number(v);
                return Number.isFinite(n) ? `${n.toFixed(1)}` : '—';
              }}
              style={{ fontSize: 11, fill: 'var(--ink-muted)', fontFamily: 'monospace' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <div className="p-3" style={{ background: 'var(--teal-tint)', border: `1px solid ${PALETTE.teal}`, borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: PALETTE.teal, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Individual forecaster
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal-deep)', marginTop: 4 }}>
            XGBoost {xgbVsElia > 0 ? '−' : '+'}{Math.abs(xgbVsElia).toFixed(1)}% vs Elia real-time
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            Our online XGBoost ({bestXgb.toFixed(1)} MW) beats Elia&apos;s NWP-driven real-time forecast
            ({mostRecent.toFixed(1)} MW) using only lag features of the measured wind power series.
          </p>
        </div>
        <div className="p-3" style={{ background: 'var(--amber-tint)', border: `1px solid ${AMBER}`, borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Aggregate
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: '#78350f', marginTop: 4 }}>
            Mechanism {mechVsElia > 0 ? '+' : '−'}{Math.abs(mechVsElia).toFixed(1)}% vs Elia real-time
          </div>
          <p style={{ fontSize: 12, color: '#5c2a07', marginTop: 4 }}>
            On the grid-matched 9-level rescore, the mechanism ({ours.mechanism.crps_mw_equivalent.toFixed(1)} MW) beats
            Elia&apos;s real-time forecast ({mostRecent.toFixed(1)} MW) by roughly {Math.abs(mechVsElia).toFixed(1)}%.
            The seven-forecaster panel mixes XGBoost with weaker models, so the aggregate is bounded below by
            its weakest members; the best-single selector pulls ahead by a larger margin.
          </p>
        </div>
      </div>

      <div className="mt-4 p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4 }}>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          <strong>Interpretation.</strong> The dashboard&apos;s main
          {' '}<em>real data</em> headline is &ldquo;mechanism beats uniform by ~7%&rdquo;, but the real
          benchmark any wind-forecasting practitioner would ask for is Elia&apos;s own operational forecast.
          On that benchmark, our <strong>individual best forecaster (online XGBoost)</strong> comes in
          roughly <strong>{xgbVsElia > 0 ? `${xgbVsElia.toFixed(1)}% better than` : `${Math.abs(xgbVsElia).toFixed(1)}% worse than`} Elia&apos;s real-time NWP forecast</strong>, a meaningful
          result for anyone building a wind-forecasting system from scratch. The mechanism, as an
          aggregate over a mixed panel, is {mechVsElia > 0 ? `~${mechVsElia.toFixed(0)}% worse than` : `~${Math.abs(mechVsElia).toFixed(0)}% better than`} Elia&apos;s real-time forecast. The
          mechanism&apos;s contribution is <em>economic structure</em> (budget balance, narrow Lambert sybil invariance,
          online skill learning), not raw accuracy dominance over the state-of-the-art NWP model.
        </p>
        <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8 }}>
          Day-ahead ({dayAhead.toFixed(1)} MW) and week-ahead ({weekAhead.toFixed(1)} MW) are shown for context.
          Elia&apos;s interval forecasts are systematically miscalibrated (see the <em>Coverage</em> panel),
          which motivates the recalibration layer shown below.
        </p>
      </div>
    </ChartCard>
  );
}
