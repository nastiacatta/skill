import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  AXIS_LABEL_FILL,
  GRID_PROPS,
  REF_LINE_STROKE,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';

/* Academic palette token — mirrors --amber in index.css. */
const AMBER = '#B45309';

/* ── Data type — mirrors calibration_recal.json ─────────────────── */

interface CalibrationRecalData {
  taus: number[];
  nominal: number[];
  mech_coverage: number[];
  recal_coverage: number[];
  mech_tail_dev: number;
  mech_centre_dev: number;
  recal_tail_dev: number;
  recal_centre_dev: number;
  mech_mean_crps: number;
  recal_mean_crps: number;
  mech_mean_sharpness: number;
  recal_mean_sharpness: number;
}

/**
 * Claim 6 + 7 panel.
 *
 * Shows:
 *  - Reliability diagram: nominal τ on x, empirical coverage on y, for
 *    mechanism vs mechanism+recalibration. The y=x diagonal is perfect
 *    calibration.
 *  - Summary cards: tail deviation, centre deviation, CRPS cost,
 *    sharpness cost. Lets the reader see the calibration-sharpness
 *    tradeoff (Gneiting–Balabdaoui–Raftery 2007) directly.
 */
export default function RecalibrationPanel() {
  const [data, setData] = useState<CalibrationRecalData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/real_data/elia_wind/data/calibration_recal.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: CalibrationRecalData) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
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
          Recalibration data not available.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div
        className="p-5 rounded-xl animate-pulse"
        role="status"
        aria-label="Loading recalibration data"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          height: 380,
        }}
      />
    );
  }

  const chartData = data.taus.map((tau, i) => ({
    tau,
    ideal: tau,
    mechanism: data.mech_coverage[i],
    recalibrated: data.recal_coverage[i],
  }));

  const tailPctDown = ((data.mech_tail_dev - data.recal_tail_dev) / data.mech_tail_dev) * 100;
  const centrePctDown = ((data.mech_centre_dev - data.recal_centre_dev) / data.mech_centre_dev) * 100;
  const crpsPctUp = ((data.recal_mean_crps - data.mech_mean_crps) / data.mech_mean_crps) * 100;
  const sharpPctDown = ((data.mech_mean_sharpness - data.recal_mean_sharpness) / data.mech_mean_sharpness) * 100;

  return (
    <ChartCard
      title="Calibration and the recalibration layer (Claims 6 and 7)"
      subtitle="Reliability diagram on the 3000-point Elia wind audit slice under expanding normalisation. The y = x diagonal is perfect calibration. Below means under-coverage, above means over-coverage. The aggregate is systematically over-covering (Ranjan–Gneiting 2010), and isotonic post-processing closes most of the gap."
      provenance={{ type: 'real', label: 'Real data, Elia wind audit slice' }}
      help={{
        term: 'Reliability diagram',
        definition: 'Plots empirical coverage (fraction of outcomes below quantile τ) against the nominal level τ. A perfectly calibrated forecast lies on y = x.',
        interpretation: 'The mechanism lies above y = x at every τ — it is systematically over-covering (too-wide intervals). The recalibrated line sits much closer to y = x, at the cost of a small CRPS increase (+1.6%) and loss of sharpness (−12%). This is the Gneiting–Balabdaoui–Raftery (2007) calibration–sharpness tradeoff.',
        axes: { x: 'Nominal level τ', y: 'Empirical coverage' },
      }}
    >
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 28, left: 52 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            type="number"
            dataKey="tau"
            domain={[0, 1]}
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            ticks={data.taus}
            label={{ value: 'Nominal level τ', position: 'insideBottom', offset: -18, fontSize: 12, fill: AXIS_LABEL_FILL }}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{ value: 'Empirical coverage', angle: -90, position: 'insideLeft', offset: 8, fontSize: 12, fill: AXIS_LABEL_FILL }}
          />
          <Tooltip content={<SmartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke={REF_LINE_STROKE}
            strokeDasharray="4 4"
            label={{ value: 'y = x (perfect calibration)', position: 'insideTopRight', fontSize: 10, fill: AXIS_LABEL_FILL }}
          />
          <Line
            type="monotone"
            dataKey="mechanism"
            name="Mechanism (linear pool)"
            stroke={PALETTE.navy}
            strokeWidth={2.5}
            dot={{ r: 4, fill: PALETTE.navy }}
          />
          <Line
            type="monotone"
            dataKey="recalibrated"
            name="Mechanism + isotonic recalibration"
            stroke={PALETTE.teal}
            strokeWidth={2.5}
            dot={{ r: 4, fill: PALETTE.teal }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid sm:grid-cols-4 gap-3 mt-4">
        <StatCard
          label="Mean tail deviation"
          before={data.mech_tail_dev}
          after={data.recal_tail_dev}
          delta={`−${tailPctDown.toFixed(0)}%`}
          direction="improvement"
          note="τ ∈ {0.1, 0.2, 0.8, 0.9}"
        />
        <StatCard
          label="Mean centre deviation"
          before={data.mech_centre_dev}
          after={data.recal_centre_dev}
          delta={`−${centrePctDown.toFixed(0)}%`}
          direction="improvement"
          note="0.4 ≤ τ ≤ 0.6"
        />
        <StatCard
          label="Mean CRPS"
          before={data.mech_mean_crps}
          after={data.recal_mean_crps}
          delta={`+${crpsPctUp.toFixed(1)}%`}
          direction="degradation"
          note="cost of calibrating"
        />
        <StatCard
          label="Mean sharpness (q(0.9) − q(0.1))"
          before={data.mech_mean_sharpness}
          after={data.recal_mean_sharpness}
          delta={`−${sharpPctDown.toFixed(0)}%`}
          direction="degradation"
          note="wider intervals"
        />
      </div>

      <div className="mt-4 p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4 }}>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          <strong>Interpretation.</strong> The mechanism&apos;s aggregate is systematically over-covering
          {(() => {
            // Look up the empirical coverage at the τ closest to 0.5 so the
            // sentence stays consistent if the tau grid ever changes.
            const idx = data.taus.reduce(
              (bestIdx, t, i) => (Math.abs(t - 0.5) < Math.abs(data.taus[bestIdx] - 0.5) ? i : bestIdx),
              0,
            );
            const tauMid = data.taus[idx];
            const covMid = data.mech_coverage[idx];
            return (
              <> — at nominal τ = {tauMid.toFixed(2)} the empirical coverage is {(covMid * 100).toFixed(1)}% (should be {(tauMid * 100).toFixed(0)}%).</>
            );
          })()}
          This is the Ranjan–Gneiting (2010) limit: a non-trivial linear pool of calibrated forecasts is
          necessarily uncalibrated. Adding a rolling isotonic recalibration layer (Kuleshov, Fenner &amp;
          Ermon 2018) as a <em>post-processing</em> step closes <strong>{centrePctDown.toFixed(0)}% of the centre deviation</strong>
          {' '}and <strong>{tailPctDown.toFixed(0)}% of the tail deviation</strong> at a CRPS cost of +{crpsPctUp.toFixed(1)}%.
          The economic structure of the mechanism (aggregation, skill, wagers, settlement) is untouched —
          recalibration is an additive post-hoc transform.
        </p>
      </div>
    </ChartCard>
  );
}

/* ── Small stat card ───────────────────────────────────────────────── */

function StatCard({
  label,
  before,
  after,
  delta,
  direction,
  note,
}: {
  label: string;
  before: number;
  after: number;
  delta: string;
  direction: 'improvement' | 'degradation';
  note: string;
}) {
  const colour =
    direction === 'improvement'
      ? { bg: 'var(--teal-tint)', border: PALETTE.teal, fg: 'var(--teal-deep)' }
      : { bg: 'var(--amber-tint)', border: AMBER, fg: '#78350f' };
  return (
    <div className="p-3" style={{ background: colour.bg, border: `1px solid ${colour.border}`, borderRadius: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colour.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-mono tabular-nums" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
          {before.toFixed(4)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>→</span>
        <span className="font-mono tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: colour.fg }}>
          {after.toFixed(4)}
        </span>
      </div>
      <div className="font-mono tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: colour.fg, marginTop: 2 }}>
        {delta}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>{note}</div>
    </div>
  );
}
