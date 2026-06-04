import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import { CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE, AXIS_LABEL_FILL, REF_LINE_STROKE, TOOLTIP_STYLE, fmt, downsample } from './shared';
import { PALETTE } from '@/lib/palette';

interface Props {
  pipeline: PipelineResult;
}

interface InvariantCheck {
  id: string;
  label: string;
  description: string;
  pass: boolean;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
}

function SmartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="font-medium text-slate-700 text-[11px] mb-1">Round {label}</div>
      {payload.filter(p => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="font-mono font-medium ml-auto">{fmt(p.value, 6)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ValidationPanel({ pipeline }: Props) {
  // framer-motion ignores prefers-reduced-motion unless told; settle instantly.
  const reduce = useReducedMotion();
  const checks = useMemo((): InvariantCheck[] => {
    const traces = pipeline.traces;
    const EPS = 1e-6;
    const results: InvariantCheck[] = [];

    // 1. Weight normalization
    let weightViolations = 0;
    let worstWeightSum = 0;
    for (const t of traces) {
      if (t.activeCount === 0) continue;
      const wSum = t.weights.reduce((a, b) => a + b, 0);
      if (Math.abs(wSum - 1) > EPS) {
        weightViolations++;
        if (Math.abs(wSum - 1) > Math.abs(worstWeightSum - 1)) worstWeightSum = wSum;
      }
    }
    results.push({
      id: 'weights',
      label: 'Weight normalization',
      description: 'Σwᵢ = 1 for active agents each round',
      pass: weightViolations === 0,
      detail: weightViolations === 0
        ? `All ${traces.length} rounds: Σwᵢ = 1.000 ± ${EPS}`
        : `${weightViolations} violations. Worst: Σw = ${worstWeightSum.toFixed(6)}`,
      severity: 'critical',
    });

    // 2. Non-negative wealth
    let wealthViolations = 0;
    let minWealth = Infinity;
    for (const t of traces) {
      for (const w of t.wealth_after) {
        if (w < -EPS) { wealthViolations++; minWealth = Math.min(minWealth, w); }
      }
    }
    results.push({
      id: 'wealth',
      label: 'Non-negative wealth',
      description: 'Wᵢ ≥ 0 for all agents at all times',
      pass: wealthViolations === 0,
      detail: wealthViolations === 0
        ? 'All wealth values non-negative across all rounds'
        : `${wealthViolations} violations. Min wealth: ${minWealth.toFixed(4)}`,
      severity: 'critical',
    });

    // 3. Score bounds
    let scoreViolations = 0;
    for (const t of traces) {
      for (let i = 0; i < t.scores.length; i++) {
        if (t.participated[i] && (t.scores[i] < -EPS || t.scores[i] > 1 + EPS)) {
          scoreViolations++;
        }
      }
    }
    results.push({
      id: 'scores',
      label: 'Score bounds',
      description: '0 ≤ sᵢ ≤ 1 for all participating agents',
      pass: scoreViolations === 0,
      detail: scoreViolations === 0
        ? 'All scores within [0, 1] bounds'
        : `${scoreViolations} out-of-bounds scores detected`,
      severity: 'critical',
    });

    // 4. Skill bounds
    let skillViolations = 0;
    const sigmaMin = pipeline.params.sigma_min;
    for (const t of traces) {
      for (const s of t.sigma_new) {
        if (s < sigmaMin - EPS || s > 1 + EPS) skillViolations++;
      }
    }
    results.push({
      id: 'skill',
      label: 'Skill bounds',
      description: `σ_min (${sigmaMin}) ≤ σᵢ ≤ 1 for all agents`,
      pass: skillViolations === 0,
      detail: skillViolations === 0
        ? `All σ values within [${sigmaMin}, 1]`
        : `${skillViolations} violations detected`,
      severity: 'warning',
    });

    // 5. Deposit feasibility
    let depositViolations = 0;
    for (const t of traces) {
      for (let i = 0; i < t.deposits.length; i++) {
        if (t.deposits[i] > t.wealth_before[i] + EPS) depositViolations++;
        if (t.deposits[i] < -EPS) depositViolations++;
      }
    }
    results.push({
      id: 'deposits',
      label: 'Deposit feasibility',
      description: '0 ≤ bᵢ ≤ Wᵢ — agents cannot deposit more than their wealth',
      pass: depositViolations === 0,
      detail: depositViolations === 0
        ? 'All deposits feasible (within agent wealth)'
        : `${depositViolations} infeasible deposits detected`,
      severity: 'critical',
    });

    // 6. Participation masking
    let maskViolations = 0;
    for (const t of traces) {
      for (let i = 0; i < t.participated.length; i++) {
        if (!t.participated[i] && t.effectiveWager[i] > EPS) maskViolations++;
      }
    }
    results.push({
      id: 'masking',
      label: 'Participation masking',
      description: 'Absent agents have zero effective wager mᵢ = 0',
      pass: maskViolations === 0,
      detail: maskViolations === 0
        ? 'All absent agents correctly masked'
        : `${maskViolations} violations: absent agents with non-zero effective wager`,
      severity: 'critical',
    });

    // 7. EWMA consistency
    let ewmaViolations = 0;
    for (let r = 1; r < traces.length; r++) {
      const prev = traces[r - 1];
      const curr = traces[r];
      for (let i = 0; i < curr.L_prev.length; i++) {
        const expectedL = prev.L_new[i];
        if (Math.abs(curr.L_prev[i] - expectedL) > EPS) ewmaViolations++;
      }
    }
    results.push({
      id: 'ewma',
      label: 'EWMA continuity',
      description: 'L_{i,t} at round start equals L_{i,t-1} at previous round end',
      pass: ewmaViolations === 0,
      detail: ewmaViolations === 0
        ? 'Loss state perfectly continuous across rounds'
        : `${ewmaViolations} discontinuities in loss tracking`,
      severity: 'warning',
    });

    return results;
  }, [pipeline]);

  const passCount = checks.filter((c) => c.pass).length;
  const totalChecks = checks.length;
  const allPass = passCount === totalChecks;

  // Budget gap time series
  const budgetData = useMemo(() => {
    return downsample(
      pipeline.traces.map((t, i) => {
        const totalIn = t.effectiveWager.reduce((a, b) => a + b, 0);
        const totalOut = t.totalPayoff.reduce((a, b) => a + b, 0);
        return {
          round: i + 1,
          gap: totalOut - totalIn,
          totalIn,
          totalOut,
        };
      }),
      300,
    );
  }, [pipeline.traces]);

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div
        className="p-5 flex items-center gap-4"
        style={{
          background: allPass ? 'var(--teal-tint)' : 'var(--crimson-tint)',
          border: `1px solid ${allPass ? 'rgba(15,118,110,0.22)' : 'rgba(154,26,47,0.22)'}`,
          borderLeft: `3px solid ${allPass ? 'var(--teal)' : 'var(--crimson)'}`,
          borderRadius: 6,
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#fff',
            border: `1.5px solid ${allPass ? 'var(--teal)' : 'var(--crimson)'}`,
            color: allPass ? 'var(--teal-deep)' : 'var(--crimson)',
            fontSize: 18,
          }}
        >
          {allPass ? '✓' : '✗'}
        </div>
        <div>
          <h3
            className="font-serif tracking-tight"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: allPass ? 'var(--teal-deep)' : '#6a1221',
            }}
          >
            {allPass ? 'All invariants pass' : `${totalChecks - passCount} invariant${totalChecks - passCount > 1 ? 's' : ''} failed`}
          </h3>
          <p
            style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginTop: 2 }}
          >
            {passCount} / {totalChecks} checks passed across {pipeline.traces.length} rounds
          </p>
        </div>
      </div>

      {/* Invariant check cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {checks.map((check, idx) => {
          const borderColor = check.pass
            ? 'var(--teal)'
            : check.severity === 'critical'
            ? 'var(--crimson)'
            : 'var(--amber)';
          const tint = check.pass
            ? 'var(--card)'
            : check.severity === 'critical'
            ? 'var(--crimson-tint)'
            : 'var(--amber-tint)';
          const badgeBg = check.severity === 'critical'
            ? 'var(--crimson-tint)'
            : check.severity === 'warning'
            ? 'var(--amber-tint)'
            : 'var(--cream)';
          const badgeColor = check.severity === 'critical'
            ? 'var(--crimson)'
            : check.severity === 'warning'
            ? 'var(--amber)'
            : 'var(--ink-soft)';

          return (
            <motion.div
              key={check.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { delay: idx * 0.04 }}
              className="p-4"
              style={{
                background: tint,
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: 4,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    width: 26, height: 26,
                    borderRadius: '50%',
                    background: '#fff',
                    border: `1.5px solid ${borderColor}`,
                    color: borderColor,
                    fontSize: 13,
                  }}
                >
                  {check.pass ? '✓' : '✗'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4
                      className="font-serif tracking-tight"
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
                    >
                      {check.label}
                    </h4>
                    <span
                      className="uppercase"
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        padding: '2px 7px',
                        borderRadius: 3,
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {check.severity}
                    </span>
                  </div>
                  <p
                    style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2, lineHeight: 1.5 }}
                  >
                    {check.description}
                  </p>
                  <p
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: check.pass ? 'var(--teal-deep)' : 'var(--crimson)',
                      marginTop: 6,
                    }}
                  >
                    {check.detail}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Budget balance chart */}
      <div
        className="p-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h4
          className="font-serif tracking-tight"
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
        >
          Budget balance over time
        </h4>
        <p
          style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3, marginBottom: 14 }}
        >
          Gap = total payout − total effective wager per round (should be near 0). Hover for values.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={budgetData} margin={CHART_MARGIN_LABELED}>
            <defs>
              <linearGradient id="budgetGradPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE.teal} stopOpacity={0.25} />
                <stop offset="100%" stopColor={PALETTE.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              dataKey="round"
              tick={AXIS_TICK}
              stroke={AXIS_STROKE}
              label={{ value: 'Round', position: 'insideBottom', offset: -18, fontSize: 11, fill: AXIS_LABEL_FILL }}
            />
            <YAxis
              tick={AXIS_TICK}
              stroke={AXIS_STROKE}
              label={{ value: 'Budget gap', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: AXIS_LABEL_FILL }}
            />
            <Tooltip content={<SmartTooltip />} />
            <ReferenceLine y={0} stroke={REF_LINE_STROKE} strokeWidth={1.5} />
            <Area
              type="monotone"
              dataKey="gap"
              name="Budget gap"
              stroke={PALETTE.navy}
              fill="url(#budgetGradPos)"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
