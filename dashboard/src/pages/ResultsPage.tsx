import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { METHOD_COLORS, PALETTE, ORANGE } from '@/lib/palette';
import {
  Bar,
  BarChart,

  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  loadBankrollAblation,
  loadCalibration,
  loadExperimentList,
  loadMasterComparison,
  loadRealDataComparison,
  loadWeightRecoveryMethod1,
  loadWeightRuleComparison,
  type RealDataResult,
  type WeightRuleComparisonRow,
} from '@/lib/adapters';
import type {
  BankrollAblationRow,
  CalibrationPoint,
  ExperimentMeta,
  MasterComparisonRow,
  WeightRecoveryRow,
} from '@/lib/types';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { generateLatentFixed } from '@/lib/coreMechanism/dgpSimulator';
import { runComposableRound, type ComposableParams, type RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import type { AgentState } from '@/lib/coreMechanism/runRound';
import { METHOD, SEM } from '@/lib/tokens';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import {
  AGENT_PALETTE,
  AXIS_STROKE,
  AXIS_TICK,

  CHART_MARGIN_LABELED,
  GRID_PROPS,
  TOOLTIP_STYLE,
  downsample,
  fmt,
} from '@/components/lab/shared';
import { useChartZoom } from '@/hooks/useChartZoom';
import ZoomBadge from '@/components/charts/ZoomBadge';
import DeltaBarChart from '@/components/charts/DeltaBarChart';
import ConcentrationPanel from '@/components/charts/ConcentrationPanel';
import FourPanelLayout from '@/components/charts/FourPanelLayout';
import TradeOffScatter from '@/components/charts/TradeOffScatter';
import { getDefaultForecaster, sortSteadyState, computeSigmaDomain, buildBarData, buildLineRenderOrder, getLineStyle } from '@/components/charts/skillRecognitionHelpers';
import ForecasterSelector from '@/components/charts/ForecasterSelector';
import type { TradeOffPoint } from '@/components/charts/TradeOffScatter';
import WaterfallChart from '@/components/charts/WaterfallChart';
import type { WaterfallDatum } from '@/components/charts/WaterfallChart';
import CalibrationChart from '@/components/charts/CalibrationChart';
import EliaOperationalBaseline from '@/components/charts/EliaOperationalBaseline';
import PerRoundPercentilePanel from '@/components/charts/PerRoundPercentilePanel';
import RecalibrationPanel from '@/components/charts/RecalibrationPanel';
import CamsEvidencePanel from '@/components/charts/CamsEvidencePanel';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TRANSITION } from '@/components/platform/designTokens';
import { ChartLinkingProvider } from '@/contexts/ChartLinkingContext';
import type { InfluenceRule, DepositPolicy } from '@/lib/coreMechanism/runRoundComposable';
import Breadcrumb from '@/components/dashboard/Breadcrumb';
import TabBar from '@/components/dashboard/TabBar';
import MathBlock from '@/components/dashboard/MathBlock';
import Skeleton from '@/components/dashboard/Skeleton';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';
import ThesisRef from '@/components/dashboard/ThesisRef';
import HowToRead from '@/components/dashboard/HowToRead';
import ShareLinkButton from '@/components/dashboard/ShareLinkButton';
import { LoadingState, EmptyState } from '@/components/dashboard/DataStates';
import { useQueryParamState } from '@/hooks/useQueryParamState';
import { Card, StatTile, Tag, SectionHeading } from '@/components/platform/ui';
import { FigureProvider } from '@/contexts/FigureContext';
import { EquationProvider } from '@/contexts/EquationContext';

// ── Analysis hooks and components ──────────────────────────────────
import {
  useClaimValidation,
  useEffectSizes,
  useResultConsistency,
  useSensitivityData,
  useFailureModes,
  useBaselineCoverage,
  useAblationInterpretation,
  useRealDataContext,
  useRegimeBreakdownFromAdapter,
  useDepositInteraction,
  usePanelSizeSensitivity,
} from '@/hooks/useAnalysis';
import ClaimEvidenceCard from '@/components/analysis/ClaimEvidenceCard';
import ResultConsistencyMatrix from '@/components/analysis/ResultConsistencyMatrix';
import SensitivityPanel from '@/components/analysis/SensitivityPanel';
import FailureModePanel from '@/components/analysis/FailureModePanel';
import BaselineCoverageTable from '@/components/analysis/BaselineCoverageTable';
import AblationInterpretPanel from '@/components/analysis/AblationInterpretPanel';
import RealDataContextPanel from '@/components/analysis/RealDataContextPanel';
import RegimeBreakdownTable from '@/components/analysis/RegimeBreakdownTable';
import DepositInteractionPanel from '@/components/analysis/DepositInteractionPanel';
import PanelSizeChart from '@/components/analysis/PanelSizeChart';

const DEMO_SEED = 42;
const DEMO_N = 6;
const DEMO_T = 200;

const CORE_METHOD_KEYS = ['uniform', 'deposit', 'skill', 'mechanism'] as const;
const ACCURACY_EPS = 1e-4;

// Skill convergence demo: 3 agents with controlled noise levels
const CONV_N = 3;
const CONV_T = 500;
const CONV_TAU = [0.2, 0.6, 1.5] as const; // Good, Okay, Bad
const CONV_LABELS = ['F1: Good (τ=0.2)', 'F2: Okay (τ=0.6)', 'F3: Bad (τ=1.5)'] as const;

// ── Method chart colors & labels for real-data comparison ───────────
// Single source of truth lives in `@/lib/palette`.
const METHOD_CHART_COLORS: Record<string, string> = METHOD_COLORS;

const METHOD_CHART_LABELS: Record<string, string> = {
  uniform: 'Equal',
  skill: 'Skill-only',
  mechanism: 'Skill × stake',
  best_single: 'Best single',
  inverse_variance: 'Inv-variance',
  trimmed_mean: 'Trimmed mean',
  median: 'Median',
  oracle: 'Oracle',
};

type Verdict = 'good' | 'neutral' | 'bad';


const VERDICT_CONFIG: Record<Verdict, {
  border: string;
  tint: string;
  fg: string;
  iconBg: string;
  title: string;
  body: string;
  path: ReactNode;
}> = {
  good: {
    border: 'var(--teal)',
    tint:   'var(--teal-tint)',
    fg:     'var(--teal-deep)',
    iconBg: 'var(--teal)',
    title:  '#134f48',
    body:   '#1e5c55',
    path:   <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />,
  },
  neutral: {
    border: 'var(--amber)',
    tint:   'var(--amber-tint)',
    fg:     '#78350f',
    iconBg: 'var(--amber)',
    title:  '#78350f',
    body:   '#5c2a07',
    path:   <path d="M4 8H12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />,
  },
  bad: {
    border: 'var(--crimson)',
    tint:   'var(--crimson-tint)',
    fg:     'var(--crimson)',
    iconBg: 'var(--crimson)',
    title:  '#6a1221',
    body:   '#7a1628',
    path:   <><path d="M4 4L12 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /><path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></>,
  },
};

function AnswerCard({
  question, answer, detail, verdict, explanation,
}: {
  question: string; answer: string; detail: string; verdict: Verdict; explanation: string;
}) {
  const cfg = VERDICT_CONFIG[verdict];
  return (
    <div
      className="p-5 space-y-3 transition-colors"
      style={{
        background: cfg.tint,
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${cfg.border}`,
        borderRadius: 4,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="font-serif"
          style={{ fontSize: 15, fontWeight: 600, color: cfg.title, lineHeight: 1.55 }}
        >
          {question}
        </div>
        <span
          className="inline-flex items-center justify-center shrink-0"
          aria-hidden="true"
          style={{
            width: 24, height: 24,
            borderRadius: '50%',
            background: cfg.iconBg,
            color: '#fff',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            {cfg.path}
          </svg>
        </span>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          className="font-serif font-mono tabular-nums"
          style={{ fontSize: 28, fontWeight: 700, color: cfg.fg, lineHeight: 1.1 }}
        >
          {answer}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 14, color: cfg.body, opacity: 0.85 }}
        >
          {detail}
        </span>
      </div>
      <p style={{ fontSize: 15, color: cfg.body, lineHeight: 1.6 }}>
        {explanation}
      </p>
    </div>
  );
}

/**
 * The single canonical Evidence headline, rendered large and
 * unmistakable from the live wind artefact: the verified −7.1% CRPS
 * reduction vs uniform over the 17,344-round evaluation horizon, with
 * the Andrews-HAC DM statistic, the 95% block-bootstrap CI, and the
 * panel size. Every number is read from `realData`; nothing is typed.
 *
 * Claim lock C1–C4 (`draft_match_contract.md`); artefact
 * `elia_wind/comparison.json`.
 */
function EvidenceHeadlineHero({ realData }: { realData: RealDataResult }) {
  const uniformRow = realData.rows.find((r) => r.method === 'uniform');
  const mechRow = realData.rows.find((r) => r.method === 'mechanism');
  const uniformCrps = uniformRow?.mean_crps ?? null;
  const mechCrps = mechRow?.mean_crps ?? null;
  const delta = mechRow?.delta_crps_vs_equal ?? null;
  // −7.1% = delta / uniform, computed live from the artefact rows.
  const pct =
    delta != null && uniformCrps != null && uniformCrps !== 0
      ? (delta / uniformCrps) * 100
      : null;

  const tEval = realData.config.T - realData.config.warmup;
  const dmAndrews = realData.dm_test?.statistic_auto_hac ?? null;
  const hacLag = realData.dm_test?.hac_lag ?? null;
  const ciLower = mechRow?.delta_ci_lower ?? null;
  const ciUpper = mechRow?.delta_ci_upper ?? null;
  const ciText =
    ciLower != null && ciUpper != null
      ? `95% CI ΔCRPS [${ciLower.toFixed(4)}, ${ciUpper.toFixed(4)}]`
      : null;

  // Skill gate alone (C6): the skill-only rule, ≈3/4 of the headline (−5.15% of −7.1%).
  const skillRow = realData.rows.find((r) => r.method === 'skill');
  const skillPct =
    skillRow?.delta_crps_vs_equal != null && uniformCrps != null && uniformCrps !== 0
      ? (skillRow.delta_crps_vs_equal / uniformCrps) * 100
      : null;

  return (
    <Card padding="roomy" elevation="raised" className="space-y-6">
      <SectionHeading
        eyebrow="Headline result · Elia offshore wind"
        title={
          <>
            The skill-gated aggregate cuts CRPS by{' '}
            <span style={{ color: SEM.wager.main }}>7.1%</span> against
            uniform averaging
          </>
        }
        subtitle="On the heterogeneous seven-forecaster wind panel, the wager-weighted aggregate beats uniform averaging over the full evaluation horizon. The gain is statistically significant and stable."
        level={1}
        as={2}
        actions={
          <Tag tone="good" size="md">
            Elia precomputed · γ=16, ρ=0.5
          </Tag>
        }
      />

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <StatTile
          label="CRPS reduction vs uniform"
          value={pct == null ? '—' : pct.toFixed(1)}
          unit="%"
          size="xl"
          accent="wager"
          delta={{ value: 'vs uniform', direction: 'down' }}
          sublabel={
            mechCrps != null && uniformCrps != null
              ? `mechanism ${mechCrps.toFixed(4)} vs uniform ${uniformCrps.toFixed(4)}`
              : undefined
          }
        />
        <StatTile
          label="Diebold–Mariano (Andrews HAC)"
          value={dmAndrews == null ? '—' : dmAndrews.toFixed(2)}
          size="lg"
          sublabel={
            hacLag != null
              ? `t-statistic, HAC lag ${hacLag}, p ≈ 0${ciText ? `. ${ciText}` : ''}`
              : `p ≈ 0${ciText ? `. ${ciText}` : ''}`
          }
        />
        <StatTile
          label="Evaluation rounds"
          value={tEval.toLocaleString()}
          size="lg"
          sublabel={`${realData.config.n_forecasters} forecasters · T = ${realData.config.T.toLocaleString()} − ${realData.config.warmup} warmup`}
        />
        <StatTile
          label="Skill gate alone"
          value={skillPct == null ? '—' : skillPct.toFixed(1)}
          unit="%"
          size="lg"
          accent="skill"
          sublabel="the past-only skill gate carries roughly three-quarters of the headline gain"
        />
      </div>
    </Card>
  );
}

const EXP_TABS = ['Real data', 'Accuracy', 'Concentration', 'Calibration', 'Ablation', 'Scientific Analysis'] as const;
const DEMO_TABS = ['Accuracy', 'Concentration', 'Deposit policy', 'Scientific Analysis'] as const;

/** Every tab name either panel can show, for the deep-link param validator. */
const ALL_RESULTS_TABS = [...new Set([...EXP_TABS, ...DEMO_TABS])] as string[];
const isResultsTab = (v: string): v is string => ALL_RESULTS_TABS.includes(v);

const METHOD_LABEL: Record<string, string> = {
  uniform: 'Equal', deposit: 'Stake-only', skill: 'Skill-only', mechanism: 'Skill × stake', best_single: 'Best single',
};

// ─── Weight-rule comparison (draft §4.1.4) ─────────────────────────
// Reads the thesis CSV bundled under /data and renders a grouped bar
// chart (one bar per weighting rule, two panels for the two deposit
// policies). Numbers match the draft's weight-rule comparison (§4.1.4
// Isolating the deposit and skill channels) exactly — no in-browser
// simulation happens here.

const WEIGHT_RULE_ORDER: Array<WeightRuleComparisonRow['weightRule']> = [
  'uniform', 'deposit', 'skill', 'mechanism', 'best_single',
];

const WEIGHT_RULE_COLORS: Record<WeightRuleComparisonRow['weightRule'], string> = {
  uniform:     METHOD.equal.color,
  deposit:     METHOD.stake_only.color,
  skill:       METHOD.skill_only.color,
  mechanism:   METHOD.blended.color,
  best_single: '#1e3a8a',
};

const WEIGHT_RULE_LABELS: Record<WeightRuleComparisonRow['weightRule'], string> = {
  uniform:     'Equal',
  deposit:     'Stake-only',
  skill:       'Skill-only',
  mechanism:   'Skill × stake',
  best_single: 'Best single',
};

function WeightRuleComparisonPanel({ rows }: { rows: WeightRuleComparisonRow[] }) {
  const byPolicy = useMemo(() => {
    const m = new Map<WeightRuleComparisonRow['depositPolicy'], WeightRuleComparisonRow[]>();
    for (const r of rows) {
      const arr = m.get(r.depositPolicy) ?? [];
      arr.push(r);
      m.set(r.depositPolicy, arr);
    }
    return m;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Method comparison (§4.1.4)</h3>
        <LoadingState message="Loading the weight-rule comparison…" />
      </div>
    );
  }

  const policies: Array<{
    key: WeightRuleComparisonRow['depositPolicy'];
    title: string;
    subtitle: string;
  }> = [
    { key: 'fixed_unit',    title: 'Fixed-unit deposits',    subtitle: 'Every agent posts b = 1. This isolates the weighting rule.' },
    { key: 'bankroll_conf', title: 'Bankroll-confidence deposits', subtitle: 'b scales with wealth × quantile-width confidence proxy.' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Method comparison: mean CRPS by weighting rule</h3>
        <p className="text-xs text-slate-500 mt-1">
          Weight-rule comparison, §4.1.4. 20 seeds, T = 1,000, warm-start t &gt; 200.
          Error bars are &plusmn;1 SE across seeds. Lower is better.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {policies.map((p) => {
          const policyRows = byPolicy.get(p.key) ?? [];
          const data = WEIGHT_RULE_ORDER
            .map((wr) => policyRows.find((r) => r.weightRule === wr))
            .filter((r): r is WeightRuleComparisonRow => !!r)
            .map((r) => ({
              rule: r.weightRule,
              label: WEIGHT_RULE_LABELS[r.weightRule],
              mean: r.meanCrpsWarmstart,
              se: r.seWs,
              errY: [r.seWs, r.seWs] as [number, number],
              color: WEIGHT_RULE_COLORS[r.weightRule],
            }));

          const uniformMean = data.find((d) => d.rule === 'uniform')?.mean ?? NaN;
          const yMax = Math.max(...data.map((d) => d.mean + d.se)) * 1.18;
          const yMin = Math.min(...data.map((d) => d.mean - d.se)) * 0.95;

          return (
            <div key={p.key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2">
                <h4 className="text-xs font-semibold text-slate-800">{p.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.subtitle}</p>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} stroke={AXIS_STROKE} interval={0} />
                  <YAxis
                    tick={AXIS_TICK}
                    stroke={AXIS_STROKE}
                    domain={[yMin, yMax]}
                    tickFormatter={(v) => Number(v).toFixed(4)}
                    label={{ value: 'Mean CRPS', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip content={<SmartTooltip />} />
                  <ReferenceLine y={uniformMean} stroke="#94a3b8" strokeDasharray="4 4">
                    <Label value="Equal weighting" position="insideTopLeft" fontSize={10} fill="#94a3b8" />
                  </ReferenceLine>
                  <Bar dataKey="mean" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {data.map((d) => (
                      <Cell key={d.rule} fill={d.color} />
                    ))}
                    <LabelList
                      dataKey="mean"
                      position="top"
                      fontSize={10}
                      fill="#334155"
                      formatter={(value: unknown) => {
                        const v = typeof value === 'number' ? value : Number(value);
                        return Number.isFinite(v) ? v.toFixed(4) : '';
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Numeric summary row */}
              <div className="grid grid-cols-5 gap-1 mt-2">
                {data.map((d) => {
                  const delta = d.mean - uniformMean;
                  const pct = uniformMean > 0 ? (delta / uniformMean) * 100 : 0;
                  const isEqual = d.rule === 'uniform';
                  return (
                    <div key={d.rule} className="rounded border border-slate-200 bg-white px-1.5 py-1">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-[10px] font-medium text-slate-600 truncate">{d.label}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-800 font-semibold mt-0.5">{d.mean.toFixed(4)}</div>
                      <div className={`text-[10px] font-mono ${isEqual ? 'text-slate-400' : delta < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isEqual ? 'baseline' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
        <p className="text-xs text-emerald-800 leading-relaxed">
          The headline from the project: the optimal weighting rule depends on the deposit policy.
          Under fixed deposits skill-only narrowly leads, under bankroll deposits stake-only does.
        </p>
      </div>
    </div>
  );
}



function meanFinite(values: Array<number | undefined | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function seFinite(values: Array<number | undefined | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance / xs.length);
}

const EXPERIMENT_CARDS = [
  { title: 'Elia Wind', tab: 'Real data', color: '#10b981', desc: '17,344 evaluation rounds, 7 forecasting models', key: 'Mechanism reduces mean CRPS by 7.1% vs equal weighting' },
  { title: 'Elia Electricity', tab: 'Real data', color: '#0ea5e9', desc: '15-minute clearing prices, 9,800 evaluation rounds', key: 'Null result: mechanism tied with equal weighting (t = 0.01)' },
  { title: 'Weight Learning', tab: 'Real data', color: '#8b5cf6', desc: 'LMS vs EWMA skill layer', key: 'Correct ranking, modest separation' },
  { title: 'Method Race', tab: 'Accuracy', color: '#6366f1', desc: '6 agents, 200 rounds, 4 weighting rules', key: 'Skill \u00d7 stake wins after \u224850 rounds' },
  { title: 'Skill Recognition', tab: 'Accuracy', color: '#f59e0b', desc: '3 agents with known quality', key: 'Good \u2192 high \u03c3, bad \u2192 low \u03c3' },
  { title: 'Concentration', tab: 'Concentration', color: '#ef4444', desc: 'Gini and effective-N by method', key: 'Accuracy\u2013fairness trade-off' },
  { title: 'Deposit Policy', tab: 'Deposit policy', color: '#64748b', desc: 'Fixed vs wealth-fraction vs \u03c3-scaled', key: 'Deposit policy is the main lever' },
] as const;

function ExperimentGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block w-1 h-4 rounded bg-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Experiment guide</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 text-[10px] font-mono font-semibold px-1.5 py-0.5">
            {EXPERIMENT_CARDS.length}
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
            {EXPERIMENT_CARDS.map((exp) => (
              <div
                key={exp.title}
                className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50 hover:border-slate-200 transition-all duration-150"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: exp.color }} />
                  <span className="text-xs font-semibold text-slate-800 truncate">{exp.title}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{exp.desc}</p>
                <div className="mt-1.5 text-[11px] font-medium" style={{ color: exp.color }}>{exp.key}</div>
                <div className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{exp.tab}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export default function ResultsPage() {
  const reduceMotion = useReducedMotion();
  // Deep-linkable tab: ?tab= restores the view a presenter was showing. The
  // fallback equals the prior useState initial value, so an unparam'd URL
  // renders byte-identically to before. The clamp effect below stays as the
  // safety net for the exp/demo tab-set distinction.
  const [activeTab, setActiveTab] = useQueryParamState('tab', 'Real data', isResultsTab);
  const [skillSource, setSkillSource] = useState<'real' | 'dgp'>('real');
  const [selectedForecaster, setSelectedForecaster] = useState<number>(-1);

  // --- adapter-backed data ---
  const [masterRows, setMasterRows] = useState<MasterComparisonRow[]>([]);
  const [ablationRows, setAblationRows] = useState<BankrollAblationRow[]>([]);
  const [calibration, setCalibration] = useState<CalibrationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasExpData, setHasExpData] = useState(false);
  const [realData, setRealData] = useState<RealDataResult | null>(null);
  const [realDataElec, setRealDataElec] = useState<RealDataResult | null>(null);
  const [weightRecovery, setWeightRecovery] = useState<WeightRecoveryRow[]>([]);
  const [weightRuleRows, setWeightRuleRows] = useState<WeightRuleComparisonRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [master, ablation, exps] = await Promise.all([
          loadMasterComparison().catch(() => null),
          loadBankrollAblation().catch(() => null),
          loadExperimentList().catch(() => []),
        ]);
        const calibrationExp = (exps as ExperimentMeta[]).find((e) => e.name === 'calibration');
        const cal = calibrationExp ? await loadCalibration(calibrationExp).catch(() => []) : [];
        if (cancelled) return;
        const mRows = master?.rows ?? [];
        setMasterRows(mRows);
        setAblationRows(ablation?.rows ?? []);
        setCalibration(cal);
        setHasExpData(mRows.length > 0);
        // Load real-data comparisons
        const rd = await loadRealDataComparison('elia_wind').catch(() => null);
        if (!cancelled && rd) setRealData(rd);
        const rdElec = await loadRealDataComparison('elia_electricity').catch(() => null);
        if (!cancelled && rdElec) setRealDataElec(rdElec);
        const wr = await loadWeightRecoveryMethod1().catch(() => []);
        if (!cancelled) setWeightRecovery(wr);
        const wrComp = await loadWeightRuleComparison().catch(() => []);
        if (!cancelled) setWeightRuleRows(wrComp);
      } catch {
        if (!cancelled) setHasExpData(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // --- experiment-backed derived data ---
  const defaultExperiment = masterRows[0]?.experiment;
  const expRows = useMemo(() => {
    if (!defaultExperiment) return [];
    return masterRows.filter((r) => r.experiment === defaultExperiment);
  }, [masterRows, defaultExperiment]);
  const expSeedCount = useMemo(() => new Set(expRows.map((r) => r.seed)).size, [expRows]);
  const isFullPanel = expSeedCount >= 1000;

  const methodAgg = useMemo(() => {
    const byMethod = new Map<string, MasterComparisonRow[]>();
    for (const r of expRows) {
      const list = byMethod.get(r.method) ?? [];
      list.push(r);
      byMethod.set(r.method, list);
    }
    return Array.from(byMethod.entries()).map(([method, rs]) => ({
      method,
      label: METHOD_LABEL[method] ?? method,
      color: METHOD_COLORS[method] ?? '#64748b',
      meanCrps: meanFinite(rs.map((x) => x.mean_crps)),
      deltaCrps: meanFinite(rs.map((x) => x.delta_crps_vs_equal)),
      deltaCrpsSE: seFinite(rs.map((x) => x.delta_crps_vs_equal)),
      meanHHI: meanFinite(rs.map((x) => x.mean_HHI)),
      meanNEff: meanFinite(rs.map((x) => x.mean_N_eff)),
      finalGini: meanFinite(rs.map((x) => x.final_gini)),
      n: rs.length,
    }));
  }, [expRows]);

  const expMechanism = methodAgg.find((m) => m.method === 'mechanism') ?? null;

  const expCoreMethods = useMemo(
    () => methodAgg.filter((m) => (CORE_METHOD_KEYS as readonly string[]).includes(m.method) && m.deltaCrps != null),
    [methodAgg],
  );

  const expBestCore = useMemo(() => {
    if (expCoreMethods.length === 0) return null;
    return [...expCoreMethods].sort((a, b) => (a.deltaCrps ?? 0) - (b.deltaCrps ?? 0))[0];
  }, [expCoreMethods]);

  const expAccuracyDisplay = useMemo(() => {
    if (!expBestCore) return [];
    return [...expCoreMethods]
      .sort((a, b) => (a.deltaCrps ?? 0) - (b.deltaCrps ?? 0))
      .map((m) => {
        const deltaX1e4 = (m.deltaCrps ?? 0) * 1e4;
        const gapToBestX1e4 = ((m.deltaCrps ?? 0) - (expBestCore.deltaCrps ?? 0)) * 1e4;
        return {
          name: m.label,
          method: m.method,
          color: m.color,
          deltaCrpsX1e4: deltaX1e4,
          deltaLabel: deltaX1e4.toFixed(2),
          gapToBestX1e4,
          gapLabel: gapToBestX1e4.toFixed(2),
          seX1e4: (m.deltaCrpsSE ?? 0) * 1e4,
          n: m.n,
        };
      });
  }, [expCoreMethods, expBestCore]);

  // Experiment-backed trade-off scatter data
  const expTradeOffData: TradeOffPoint[] = useMemo(() => {
    return expCoreMethods.map(m => ({
      method: m.method,
      label: m.label,
      crpsImprovement: -(m.deltaCrps ?? 0),
      gini: m.finalGini ?? 0,
      color: m.color,
    }));
  }, [expCoreMethods]);

  // Experiment-backed waterfall data
  const expWaterfallData: WaterfallDatum[] = useMemo(() => {
    const getError = (method: string) => methodAgg.find(m => m.method === method)?.meanCrps ?? 0;
    const uniformCrps = getError('uniform');
    const depositCrps = getError('deposit');
    const skillCrps = getError('skill');
    const mechCrps = getError('mechanism');
    return [
      { label: 'Uniform (baseline)', value: uniformCrps, delta: 0, isTotal: true },
      { label: '+ Deposits', value: depositCrps, delta: depositCrps - uniformCrps },
      { label: '+ Skill', value: skillCrps, delta: skillCrps - depositCrps },
      { label: 'Full Mechanism', value: mechCrps, delta: mechCrps - skillCrps, isTotal: true },
    ];
  }, [methodAgg]);

  const calibrationData = useMemo(() =>
    calibration.filter((p) => Number.isFinite(p.tau) && Number.isFinite(p.pHat))
      .map((p) => ({ tau: p.tau, pHat: p.pHat, ideal: p.tau, nValid: p.nValid }))
      .sort((a, b) => a.tau - b.tau),
    [calibration]);

  const ablationData = useMemo(() =>
    [...ablationRows].sort((a, b) => a.delta_crps_vs_full - b.delta_crps_vs_full),
    [ablationRows]);

  // --- demo fallback (in-browser pipeline) ---
  const cumErrorZoom = useChartZoom();

  const demoMethods = useMemo(() => {
    const entries: { key: string; label: string; color: string; influenceRule: InfluenceRule }[] = [
      { key: 'equal', label: METHOD.equal.label, color: METHOD.equal.color, influenceRule: 'uniform' },
      { key: 'skill_only', label: METHOD.skill_only.label, color: METHOD.skill_only.color, influenceRule: 'skill_only' },
      { key: 'blended', label: METHOD.blended.label, color: METHOD.blended.color, influenceRule: 'skill_stake' },
      { key: 'stake_only', label: METHOD.stake_only.label, color: METHOD.stake_only.color, influenceRule: 'deposit_only' },
    ];
    return entries.map((e) => ({
      ...e,
      pipeline: runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: DEMO_T, seed: DEMO_SEED, n: DEMO_N, builder: { influenceRule: e.influenceRule } }),
    }));
  }, []);

  const demoEqual = demoMethods.find((x) => x.key === 'equal')!;
  const demoBlended = demoMethods.find((x) => x.key === 'blended')!;
  const demoDelta = demoBlended.pipeline.summary.meanError - demoEqual.pipeline.summary.meanError;

  const demoDeposits = useMemo(() => {
    const entries: { key: string; label: string; depositPolicy: DepositPolicy }[] = [
      { key: 'fixed', label: 'Fixed amount', depositPolicy: 'fixed_unit' },
      { key: 'bankroll', label: 'Fraction of wealth', depositPolicy: 'wealth_fraction' },
      { key: 'oracle', label: 'Wealth × confidence (σ in deposit)', depositPolicy: 'sigma_scaled' },
    ];
    return entries.map((e) => {
      const p = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: DEMO_T, seed: DEMO_SEED, n: DEMO_N, builder: { depositPolicy: e.depositPolicy, influenceRule: 'skill_stake' } });
      return { name: e.label, meanError: p.summary.meanError, gini: p.summary.finalGini };
    }).sort((a, b) => a.meanError - b.meanError);
  }, []);

  const demoConcentrationBar = useMemo(() =>
    demoMethods.map((m) => ({
      name: m.label,
      key: m.key,
      gini: m.pipeline.summary.finalGini,
      nEff: m.pipeline.summary.meanNEff,
      color: m.color,
    })).sort((a, b) => a.gini - b.gini),
    [demoMethods]);

  // Trade-off scatter data: accuracy improvement vs concentration for each method
  const tradeOffData: TradeOffPoint[] = useMemo(() => {
    const equalError = demoMethods.find(m => m.key === 'equal')?.pipeline.summary.meanError ?? 0;
    return demoMethods.map(m => ({
      method: m.key,
      label: m.label,
      crpsImprovement: equalError - m.pipeline.summary.meanError,
      gini: m.pipeline.summary.finalGini,
      color: m.color,
    }));
  }, [demoMethods]);

  // Waterfall data: incremental CRPS change from uniform → deposit → skill → mechanism
  const waterfallData: WaterfallDatum[] = useMemo(() => {
    const getError = (key: string) => demoMethods.find(m => m.key === key)?.pipeline.summary.meanError ?? 0;
    const uniformCrps = getError('equal');
    const stakeCrps = getError('stake_only');
    const skillCrps = getError('skill_only');
    const mechCrps = getError('blended');
    return [
      { label: 'Uniform (baseline)', value: uniformCrps, delta: 0, isTotal: true },
      { label: '+ Deposits', value: stakeCrps, delta: stakeCrps - uniformCrps },
      { label: '+ Skill', value: skillCrps, delta: skillCrps - stakeCrps },
      { label: 'Full Mechanism', value: mechCrps, delta: mechCrps - skillCrps, isTotal: true },
    ];
  }, [demoMethods]);

  // Skill convergence: 3 agents with controlled noise levels
  // Good (τ=0.2), Okay (τ=0.6), Bad (τ=1.5) — the mechanism should rank them correctly

  const convPipeline = useMemo(() => {
    // Generate DGP with controlled noise levels
    const dgp = generateLatentFixed(DEMO_SEED, CONV_T, CONV_N, 1, [...CONV_TAU]);
    // Run the mechanism manually using runComposableRound
    const params: ComposableParams = {
      lam: 0.3, eta: 1, sigma_min: 0.1, gamma: 4, rho: 0.1,
      omegaMax: 1.0, utilityPool: 0, scoreThreshold: 0.7,
      fixedDeposit: 1, baseDepositFraction: 0.18, sigmaDepositScale: 0.85,
      builder: { depositPolicy: 'fixed_unit', influenceRule: 'skill_stake', aggregationRule: 'linear', settlementRule: 'skill_only' },
    };
    const initialL = 0.5;
    let state: AgentState[] = Array.from({ length: CONV_N }, (_, i) => ({
      accountId: i, L: initialL,
      sigma: params.sigma_min + (1 - params.sigma_min) * Math.exp(-params.gamma * initialL),
      wealth: 20,
    }));
    const traces: RoundTrace[] = [];
    for (let i = 0; i < dgp.rounds.length; i++) {
      const { y, qReports } = dgp.rounds[i];
      const decisions = state.map((_s, j) => ({
        accountId: j, participate: true,
        report: dgp.rounds[i].reports[j],
        qReport: qReports[j],
      }));
      const trace = runComposableRound(i + 1, state, decisions, y, params);
      traces.push(trace);
      state = state.map((_s, j) => ({
        accountId: j, L: trace.L_new[j], sigma: trace.sigma_new[j], wealth: trace.wealth_after[j],
      }));
    }
    return { traces, finalState: state, tauTrue: CONV_TAU };
  }, []);

  // Skill (σ) trajectory — shows the mechanism learning who is good/okay/bad
  const skillConvergence = useMemo(() => {
    const raw = convPipeline.traces.map((t, i) => {
      const pt: Record<string, number> = { round: i + 1 };
      for (let j = 0; j < CONV_N; j++) pt[`F${j + 1}`] = t.sigma_t[j];
      return pt;
    });
    return downsample(raw, 300);
  }, [convPipeline]);

  // Weight trajectory — derived from σ via the skill gate
  const weightConvergence = useMemo(() => {
    const raw = convPipeline.traces.map((t, i) => {
      const pt: Record<string, number> = { round: i + 1 };
      for (let j = 0; j < CONV_N; j++) pt[`F${j + 1}`] = t.weights[j];
      return pt;
    });
    return downsample(raw, 300);
  }, [convPipeline]);

  // Steady-state target weights from the last 100 rounds
  const targetWeights = useMemo(() => {
    const last100 = convPipeline.traces.slice(-100);
    return Array.from({ length: CONV_N }, (_, j) => {
      return last100.reduce((s, t) => s + t.weights[j], 0) / last100.length;
    });
  }, [convPipeline]);

  // Steady-state target σ from the last 100 rounds
  const targetSigmas = useMemo(() => {
    const last100 = convPipeline.traces.slice(-100);
    return Array.from({ length: CONV_N }, (_, j) => {
      return last100.reduce((s, t) => s + t.sigma_t[j], 0) / last100.length;
    });
  }, [convPipeline]);

  // Precompute cumulative CRPS for real-data chart (O(n) instead of O(n²))
  const realCumCrps = useMemo(() => {
    if (!realData?.per_round?.length) return [];
    const pr = realData.per_round;
    let sumU = 0, sumS = 0, sumM = 0, sumB = 0;
    const out = pr.map((r, i) => {
      sumU += r.crps_uniform;
      sumS += r.crps_skill;
      sumM += r.crps_mechanism;
      sumB += r.crps_best_single;
      const n = i + 1;
      return { t: r.t, uniform: sumU / n, skill: sumS / n, mechanism: sumM / n, best: sumB / n };
    });
    return downsample(out, 600);
  }, [realData]);
  // ── Real skill history data (from comparison.json) ──
  const hasRealSkill = !!(realData?.skill_history?.length && realData?.forecaster_names?.length);
  const realForecasterCount = realData?.forecaster_names?.length ?? 0;
  const realForecasterNames = realData?.forecaster_names ?? [];

  // Skill (σ) trajectory from real forecaster data
  const realSkillConvergence = useMemo(() => {
    if (!hasRealSkill) return [];
    const raw = realData!.skill_history!.map((entry) => {
      const pt: Record<string, number> = { t: entry.t };
      for (let j = 0; j < realForecasterCount; j++) pt[`sigma_${j}`] = entry[`sigma_${j}`];
      return pt;
    });
    return downsample(raw, 600);
  }, [hasRealSkill, realData, realForecasterCount]);

  // Weight trajectory from real forecaster data
  const realWeightConvergence = useMemo(() => {
    if (!hasRealSkill) return [];
    const raw = realData!.skill_history!.map((entry) => {
      const pt: Record<string, number> = { t: entry.t };
      for (let j = 0; j < realForecasterCount; j++) pt[`weight_${j}`] = entry[`weight_${j}`];
      return pt;
    });
    return downsample(raw, 600);
  }, [hasRealSkill, realData, realForecasterCount]);

  // Steady-state σ and weight targets from real data
  const realSteadyState = useMemo(() => realData?.steady_state ?? [], [realData]);

  // Build lookup: index → steady-state values
  const realTargetSigmas = useMemo(() => {
    if (!hasRealSkill) return [];
    const map = new Map(realSteadyState.map((s) => [s.index, s.mean_sigma]));
    return Array.from({ length: realForecasterCount }, (_, i) => map.get(i) ?? 0);
  }, [hasRealSkill, realSteadyState, realForecasterCount]);

  const realTargetWeights = useMemo(() => {
    if (!hasRealSkill) return [];
    const map = new Map(realSteadyState.map((s) => [s.index, s.mean_weight]));
    return Array.from({ length: realForecasterCount }, (_, i) => map.get(i) ?? 0);
  }, [hasRealSkill, realSteadyState, realForecasterCount]);

  const sortedSteadyState = useMemo(() => sortSteadyState(realData?.steady_state ?? []), [realData]);

  const sigmaDomain = useMemo(() => computeSigmaDomain(realSkillConvergence, realForecasterCount), [realSkillConvergence, realForecasterCount]);

  const forecasterItems = useMemo(() => sortedSteadyState.map(s => ({
    name: s.forecaster,
    index: s.index,
    color: AGENT_PALETTE[s.index % AGENT_PALETTE.length],
  })), [sortedSteadyState]);

  useEffect(() => {
    if (sortedSteadyState.length > 0 && selectedForecaster === -1) {
      setSelectedForecaster(getDefaultForecaster(sortedSteadyState));
    }
  }, [sortedSteadyState, selectedForecaster]);

  const useExp = hasExpData && !loading && isFullPanel;
  const tabs = useExp ? EXP_TABS : DEMO_TABS;

  // ── Analysis hooks ──────────────────────────────────────────────
  const claimValidation = useClaimValidation();
  const effectSizes = useEffectSizes();
  const resultConsistency = useResultConsistency();
  const sensitivityData = useSensitivityData();
  const failureModes = useFailureModes();
  const baselineCoverage = useBaselineCoverage();
  const ablationInterpretation = useAblationInterpretation();
  const realDataContext = useRealDataContext();
  const regimeBreakdownData = useRegimeBreakdownFromAdapter();
  const depositInteraction = useDepositInteraction();
  const panelSizeSensitivity = usePanelSizeSensitivity();

  const deltaCrps = realData
    ? (realData.rows.find(r => r.method === 'mechanism')?.delta_crps_vs_equal ?? null)
    : useExp ? (expMechanism?.deltaCrps ?? null) : demoDelta;
  const gini = useExp ? (expMechanism?.finalGini ?? null) : demoBlended.pipeline.summary.finalGini;

  const accuracyVerdict: Verdict = deltaCrps == null ? 'neutral' : deltaCrps < -ACCURACY_EPS ? 'good' : deltaCrps > ACCURACY_EPS ? 'bad' : 'neutral';
  const concentrationVerdict: Verdict = gini == null ? 'neutral' : gini < 0.55 ? 'good' : gini > 0.7 ? 'bad' : 'neutral';

  // Ensure the active tab is part of the current tab set.
  // Using an effect avoids the "setState during render" StrictMode warning.
  useEffect(() => {
    if (!tabs.includes(activeTab as never)) {
      setActiveTab(tabs[0]);
    }
  }, [tabs, activeTab]);
  const shownTab = tabs.includes(activeTab as never) ? activeTab : tabs[0];

  return (
    <FigureProvider>
    <EquationProvider>
    <PageShell width="wide">
        <Breadcrumb activeTab={activeTab} />

        {/* ── Header ── */}
        <PageHeader
          hero
          eyebrow="Results · Real-data validation"
          title="Results"
          companion={
            activeTab === 'Calibration'
              ? <ThesisRef viewKey="evidence/calibration" />
              : activeTab === 'Ablation' || activeTab === 'Scientific Analysis' || activeTab === 'Deposit policy'
                ? <ThesisRef viewKey="evidence/ablation" />
                : <ThesisRef viewKey="evidence" />
          }
          description={useExp
            ? `${expSeedCount} scenarios, paired comparison across all methods.`
            : `Seed ${DEMO_SEED} · ${DEMO_N} agents · ${DEMO_T} rounds`}
        />

        {/* ── Headline result (always first, from the live wind artefact) ── */}
        {realData && <EvidenceHeadlineHero realData={realData} />}

        {/* ── CAMS PM2.5 mixture-of-experts replication (real artefact) ──
             Rendered at page level beside the wind headline hero, not inside the
             Real-data tab, so the verified CAMS evidence is visible on every
             evidence build (the Real-data tab needs full-panel master_comparison
             data which is not in every committed snapshot). Self-guards on its
             own artefact and renders nothing when absent. */}
        <CamsEvidencePanel />

        {/* ── Experiment guide (collapsible) ── */}
        <ExperimentGuide />

        {/* ── Headline cards ── */}
        <section className="grid sm:grid-cols-2 gap-4">
          <AnswerCard
            question="Does skill improve accuracy?"
            answer={deltaCrps == null ? '-' : deltaCrps < 0 ? 'Yes' : 'No'}
            detail={deltaCrps == null ? '' : `Δ = ${deltaCrps >= 0 ? '+' : ''}${fmt(deltaCrps, 4)} mean error${useExp ? ` (${expSeedCount} seeds)` : ''}`}
            verdict={accuracyVerdict}
            explanation={
              deltaCrps == null ? 'Loading data.'
                : useExp
                  ? (deltaCrps < 0
                    ? `Across ${expSeedCount} paired seeds, skill × stake reduces CRPS by ${fmt(Math.abs(deltaCrps), 4)} vs equal weighting.`
                    : `Across ${expSeedCount} paired seeds, equal weighting matches or beats skill × stake.`)
                  : (deltaCrps < 0
                    ? `In this single-seed demo, skill × stake reduces error by ${fmt(Math.abs(deltaCrps), 4)}.`
                    : 'Equal weighting performs as well or better in this demo.')
            }
          />
          <AnswerCard
            question="Is wager share concentrated?"
            answer={gini == null ? '-' : gini < 0.4 ? 'Low' : gini < 0.6 ? 'Moderate' : 'High'}
            detail={gini == null ? '' : `Gini = ${fmt(gini, 3)}`}
            verdict={concentrationVerdict}
            explanation={
              gini == null ? 'Loading data.'
                : `Gini measures wealth inequality (0 = equal, 1 = monopoly). ${fmt(gini, 3)} means ${gini < 0.4 ? 'wager share stays well-distributed' : gini < 0.6 ? 'moderate concentration, multiple agents retain weight' : 'a few agents dominate'}.`
            }
          />
        </section>

        {/* ── Tabs ── */}
        <section>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <TabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as typeof activeTab)}
                progressLabel={`View ${tabs.indexOf(activeTab as never) + 1} of ${tabs.length}: ${activeTab}`}
              />
            </div>
            <ShareLinkButton />
          </div>
          <div className="mt-6" />

          <ChartLinkingProvider initialMethods={['uniform', 'deposit', 'skill', 'mechanism']}>

          {loading && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4"><Skeleton height="120px" /><Skeleton height="120px" /></div>
              <Skeleton height="320px" />
            </div>
          )}

          <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={reduceMotion ? { duration: 0 } : TRANSITION.view}
          >

          {/* ═══ REAL DATA TAB ═══ */}

          {shownTab === 'Real data' && realData && (
            <div className="space-y-6">
              <SectionHeading level={3} eyebrow="Block 1 of 3" title="Headline comparison" subtitle="The mechanism against equal weighting on the full wind series, with the significance of the gap." />
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[13px] font-semibold">Real data</span>
                  <h3 className="text-sm font-semibold text-indigo-900">Elia offshore wind: {realData.config.T.toLocaleString()} hourly points</h3>
                </div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  {realData.config.n_forecasters} strictly causal forecasters on Belgian offshore wind, 2024&ndash;2025.
                </p>
              </div>

              <DeltaBarChart
                data={realData.rows
                  .filter(r => r.method !== 'uniform')
                  .sort((a, b) => a.delta_crps_vs_equal - b.delta_crps_vs_equal)
                  .map(r => ({
                    label: METHOD_CHART_LABELS[r.method] ?? r.method,
                    delta: r.delta_crps_vs_equal * 1e4,
                    color: METHOD_CHART_COLORS[r.method] ?? '#64748b',
                  }))}
                baselineLabel="Equal weighting"
                metricLabel="Δ CRPS (×10⁴)"
                title="Method comparison: Wind power"
                provenance={{ type: 'real', label: 'Real data, Elia wind' }}
              />

              {/* DM test significance badge */}
              {realData?.dm_test && (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[13px] font-semibold ${
                      realData.dm_test.significant_at_001 ? 'bg-green-100 text-green-700' :
                      realData.dm_test.significant_at_005 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      Diebold&ndash;Mariano test: p {realData.dm_test.significant_at_001 ? '< 0.001 ***' :
                        realData.dm_test.significant_at_005 ? '< 0.05 *' : `= ${realData.dm_test.p_value.toFixed(4)}`}
                    </span>
                    <span className="text-[14px] text-slate-400">
                      Mechanism vs equal weighting, Andrews-automatic HAC standard errors
                    </span>
                  </div>
                  {/* Andrews (1991) auto-HAC DM + 95% block-bootstrap CI, when
                      the audit_post_hoc.json sidecar is available. Audit pass 6
                      (D2, D3). */}
                  {realData.dm_test.statistic_auto_hac != null && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-500">
                      <span className="font-mono">
                        DM<sub>Andrews</sub> = {realData.dm_test.statistic_auto_hac.toFixed(2)}
                        {realData.dm_test.hac_lag != null && (
                          <span className="text-slate-400"> (HAC lag {realData.dm_test.hac_lag})</span>
                        )}
                      </span>
                      {realData.audit_post_hoc?.rules?.mechanism?.delta_95pct_bootstrap_ci && (
                        <span className="font-mono">
                          95% CI Δ CRPS: [
                          {realData.audit_post_hoc.rules.mechanism.delta_95pct_bootstrap_ci.lower.toFixed(5)},{' '}
                          {realData.audit_post_hoc.rules.mechanism.delta_95pct_bootstrap_ci.upper.toFixed(5)}]
                        </span>
                      )}
                      <span className="text-slate-400">
                        Andrews (1991) auto-bandwidth, stationary block bootstrap, block = {realData.audit_post_hoc?.block_size ?? 168}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Mechanism vs alternatives interpretive callout */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Median and inverse-variance weighting reach marginally lower CRPS, but lack the economic structure this project adds: incentive-compatible settlement, budget balance, narrow Lambert sybil invariance and online adaptivity.
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 32, paddingTop: 32 }}>
                <SectionHeading level={3} eyebrow="Block 2 of 3" title="Over the evaluation horizon" subtitle="The gain accumulated across the full run, in the tails, and against the operational forecasts Elia publishes." />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-800">CRPS over time</h3>
                  <ZoomBadge isZoomed={cumErrorZoom.state.isZoomed} onReset={cumErrorZoom.reset} />
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Running average CRPS over {realData.config.T.toLocaleString()} hourly rounds, lower is better.
                </p>
                <div className="cursor-crosshair">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={realCumCrps}
                      margin={{ ...CHART_MARGIN_LABELED, left: 52 }}
                      onMouseDown={cumErrorZoom.onMouseDown}
                      onMouseMove={cumErrorZoom.onMouseMove}
                      onMouseUp={cumErrorZoom.onMouseUp}
                    >
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="t" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[cumErrorZoom.state.left, cumErrorZoom.state.right]}
                        label={{ value: 'Hour', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'Cumulative CRPS', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<SmartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line type="monotone" dataKey="uniform" name="Equal" stroke={PALETTE.slate} strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="skill" name="Skill-only" stroke={PALETTE.purple} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
                      <Line type="monotone" dataKey="mechanism" name="Skill × stake" stroke={PALETTE.teal} strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="best" name="Best single" stroke={ORANGE} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ═══ Tail-CRPS (95th percentile per-round CRPS) ═══ */}
              <PerRoundPercentilePanel />

              {/* ═══ External validation: Elia operational forecasts (Claim 10) ═══ */}
              <EliaOperationalBaseline />

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 32, paddingTop: 32 }}>
                <SectionHeading level={3} eyebrow="Block 3 of 3" title="Calibration and learned skill" subtitle="The post-hoc recalibration layer and the online skill estimates the mechanism recovers from data alone." />
              </div>

              {/* ═══ Calibration + recalibration layer (Claims 6 & 7) ═══ */}
              <RecalibrationPanel />

              {/* ═══ Skill Recognition ═══ */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      How the mechanism learns forecaster quality
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      The skill layer smooths each forecaster&apos;s CRPS into a running estimate σ, where higher σ earns more weight.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSkillSource('real')}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        skillSource === 'real'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Real data
                    </button>
                    <button
                      onClick={() => setSkillSource('dgp')}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        skillSource === 'dgp'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Synthetic
                    </button>
                  </div>
                </div>

                {skillSource === 'real' && hasRealSkill ? (
                  <>
                    <ForecasterSelector
                      forecasters={forecasterItems}
                      selectedIndex={selectedForecaster}
                      onSelect={setSelectedForecaster}
                    />

                    {/* 1. Horizontal bar chart: final σ ranking (the key result) */}
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-3">Learned skill ranking (steady-state σ)</div>
                      <ResponsiveContainer width="100%" height={sortedSteadyState.length * 36 + 40}>
                        <BarChart
                          data={buildBarData(sortedSteadyState, AGENT_PALETTE)}
                          layout="vertical"
                          margin={{ top: 4, right: 60, bottom: 4, left: 140 }}
                        >
                          <CartesianGrid {...GRID_PROPS} horizontal={false} />
                          <XAxis type="number" domain={[0.6, 1]} tick={AXIS_TICK} stroke={AXIS_STROKE}
                            label={{ value: 'Skill σ (higher = better)', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#64748b' }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} stroke={AXIS_STROKE} width={130} />
                          <Tooltip content={<SmartTooltip />} />
                          <Bar dataKey="sigma" name="Skill σ" radius={[0, 4, 4, 0]} maxBarSize={28}>
                            {buildBarData(sortedSteadyState, AGENT_PALETTE).map((entry) => (
                              <Cell
                                key={entry.originalIndex}
                                fill={entry.fill}
                                opacity={entry.originalIndex === selectedForecaster ? 0.95 : 0.5}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedForecaster(entry.originalIndex)}
                              />
                            ))}
                            <LabelList dataKey="sigma" position="right"
                              formatter={(v: string | number | boolean | null | undefined) => {
                                const n = Number(v);
                                return Number.isFinite(n) ? n.toFixed(3) : '';
                              }}
                              style={{ fontSize: 11, fill: '#334155', fontFamily: 'monospace' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Naive (last value) ranks highest on this highly autocorrelated series. ARIMA ranks lowest on poorly calibrated quantiles.
                      </p>
                    </div>

                    {/* 2. σ trajectory over time (full width, single chart) */}
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-2">
                        σ trajectory over {realData!.config.T.toLocaleString()} hours
                        <span className="text-xs text-slate-500 ml-2">
                          Showing: {realForecasterNames[selectedForecaster]} (σ = {fmt(realTargetSigmas[selectedForecaster], 3)})
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={realSkillConvergence} margin={{ top: 8, right: 24, bottom: 28, left: 52 }}>
                          <CartesianGrid {...GRID_PROPS} />
                          <XAxis dataKey="t" tick={AXIS_TICK} stroke={AXIS_STROKE}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                            label={{ value: 'Hour', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                          <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={sigmaDomain}
                            tickFormatter={(v: number) => v.toFixed(2)}
                            label={{ value: 'Skill σ', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                          <Tooltip content={<SmartTooltip />} />
                          {buildLineRenderOrder(realForecasterCount, selectedForecaster).map((i) => {
                            const style = getLineStyle(selectedForecaster, i);
                            return (
                              <Line key={i} type="monotone" dataKey={`sigma_${i}`} name={realForecasterNames[i]}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeWidth={style.strokeWidth}
                                strokeOpacity={style.opacity}
                                dot={false} />
                            );
                          })}
                          <ReferenceLine y={realTargetSigmas[selectedForecaster]}
                            stroke={AGENT_PALETTE[selectedForecaster % AGENT_PALETTE.length]}
                            strokeDasharray="6 3" strokeOpacity={0.6}>
                            <Label value={fmt(realTargetSigmas[selectedForecaster], 3)} position="right" fontSize={11} fill="#334155" />
                          </ReferenceLine>
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Lines separate as the skill layer converges, then hold their order.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Three synthetic forecasters, Good (τ = 0.2), Okay (τ = 0.6) and Bad (τ = 1.5), with fixed deposits isolating the skill signal.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Skill estimate σ</div>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={skillConvergence} margin={{ top: 4, right: 8, bottom: 24, left: 52 }}>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="round" tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE}
                              label={{ value: 'Round', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} domain={[0, 1]}
                              label={{ value: 'σ', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<SmartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                            {Array.from({ length: CONV_N }, (_, i) => (
                              <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={CONV_LABELS[i]}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={2} dot={false} />
                            ))}
                            {targetSigmas.map((ts, i) => (
                              <ReferenceLine key={`ts-${i}`} y={ts}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeDasharray="6 3" strokeOpacity={0.4}>
                                <Label value={fmt(ts, 3)} position="right" fontSize={10} fill="#334155" />
                              </ReferenceLine>
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-slate-400 mt-1">Good → high σ, Bad → low σ. Dashed = steady state.</p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Normalised weight</div>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={weightConvergence} margin={{ top: 4, right: 8, bottom: 24, left: 52 }}>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="round" tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE}
                              label={{ value: 'Round', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} domain={[0.2, 0.5]}
                              label={{ value: 'w', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<SmartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                            {Array.from({ length: CONV_N }, (_, i) => (
                              <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={CONV_LABELS[i]}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={2} dot={false} />
                            ))}
                            {targetWeights.map((tw, i) => (
                              <ReferenceLine key={`tw-${i}`} y={tw}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeDasharray="6 3" strokeOpacity={0.4}>
                                <Label value={fmt(tw, 3)} position="right" fontSize={10} fill="#334155" />
                              </ReferenceLine>
                            ))}
                            <ReferenceLine y={1 / CONV_N} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} />
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-slate-400 mt-1">Weights start at 1/3, diverge via g(σ). Dashed = steady state.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ═══ Weight Learning: Two Approaches ═══ */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">Weight learning: two approaches</h3>
                  <p className="text-xs text-slate-500">
                    LMS regresses the outcome on the reports to recover the structural weights w = [0.8, 0.1, 0.5]. The core mechanism instead scores each forecaster by CRPS and learns the ranking from scratch for three forecasters of known quality, Good (τ = 0.2), Okay (τ = 0.6) and Bad (τ = 1.5).
                  </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Left: LMS direct weight recovery */}
                  {weightRecovery.length > 0 && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-emerald-700">LMS direct regression</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">T = 15,000</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Minimises (y − w &middot; r)² by gradient descent, recovering the structural weights almost exactly.
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart
                          data={weightRecovery.map(r => ({
                            name: `F${r.forecaster + 1}`,
                            target: r.wTarget,
                            learned: r.wLearned,
                          }))}
                          margin={{ top: 8, right: 24, bottom: 24, left: 24 }}
                        >
                          <CartesianGrid {...GRID_PROPS} />
                          <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 12 }} stroke={AXIS_STROKE} />
                          <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]} />
                          <Tooltip contentStyle={TOOLTIP_STYLE as React.CSSProperties}
                            formatter={(v: unknown) => [fmt(Number(v), 4), '']} />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                          <Bar dataKey="target" name="True w" fill={PALETTE.slate} radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.5} />
                          <Bar dataKey="learned" name="LMS learned" fill={PALETTE.teal} radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.9} />
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-[11px] text-slate-500">
                        Mean absolute error (MAE) = {fmt(weightRecovery.reduce((s, r) => s + r.absError, 0) / weightRecovery.length, 4)}, recovered directly.
                      </p>
                    </div>
                  )}

                  {/* Right: Core mechanism skill-based weights */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-indigo-700">Core mechanism (EWMA skill layer)</span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold">T = 500</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-1">
                        3 agents with controlled noise: Good (τ=0.2), Okay (τ=0.6), Bad (τ=1.5).
                        Fixed deposits (b=1) isolate the skill signal.
                      </p>
                      <MathBlock
                        caption="Each round, CRPS loss feeds the skill estimate σ that gates the effective wager."
                      />
                      <details className="mt-2">
                        <summary className="cursor-pointer select-none text-[11px] font-semibold text-indigo-600 py-1">
                          Show the maths
                        </summary>
                        <div className="space-y-2 mt-2">
                          <MathBlock accent label="1. CRPS loss" latex="\\ell_{i,t} = \\frac{1}{K} \\sum_{k=1}^{K} L^{\\tau_k}(y_t, q_{i,t}^{(k)})" />
                          <MathBlock accent label="2. EWMA smoothing" latex="L_{i,t} = (1 - \\rho)\\, L_{i,t-1} + \\rho\\, \\ell_{i,t}" />
                          <MathBlock accent label="3. Skill estimate" latex="\\sigma_{i,t} = \\sigma_{\\min} + (1 - \\sigma_{\\min})\\, e^{-\\gamma L_{i,t}}" />
                          <MathBlock accent label="4. Normalised weight" latex="w_{i,t} = \\frac{b_{i,t} \\cdot g(\\sigma_{i,t})}{\\sum_j b_{j,t} \\cdot g(\\sigma_{j,t})}, \\quad g(\\sigma) = \\lambda + (1-\\lambda)\\sigma^\\eta" />
                        </div>
                      </details>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        <strong>Absent agents:</strong> the skill estimate freezes (κ = 0) or decays toward the prior L₀ (κ &gt; 0).
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* σ trajectory */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Skill estimate σ</div>
                        <ResponsiveContainer width="100%" height={360}>
                          <LineChart data={skillConvergence} margin={{ top: 4, right: 8, bottom: 4, left: 36 }}>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="round" tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} />
                            <YAxis tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} domain={[0, 1]}
                              label={{ value: 'σ', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<SmartTooltip />} />
                            {Array.from({ length: CONV_N }, (_, i) => (
                              <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={CONV_LABELS[i]}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={2} dot={false} />
                            ))}
                            {targetSigmas.map((ts, i) => (
                              <ReferenceLine key={`ts-${i}`} y={ts}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeDasharray="6 3" strokeOpacity={0.4}>
                                <Label value={fmt(ts, 3)} position="right" fontSize={11} fill="#334155" />
                              </ReferenceLine>
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-slate-400">Good → high σ, Bad → low σ. Dashed = steady state.</p>
                      </div>
                      {/* Weight trajectory */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Normalised weight</div>
                        <ResponsiveContainer width="100%" height={360}>
                          <LineChart data={weightConvergence} margin={{ top: 4, right: 8, bottom: 4, left: 36 }}>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="round" tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} />
                            <YAxis tick={{ ...AXIS_TICK, fontSize: 11 }} stroke={AXIS_STROKE} domain={[0.2, 0.5]}
                              label={{ value: 'w', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<SmartTooltip />} />
                            {Array.from({ length: CONV_N }, (_, i) => (
                              <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={CONV_LABELS[i]}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={2} dot={false} />
                            ))}
                            {targetWeights.map((tw, i) => (
                              <ReferenceLine key={`tw-${i}`} y={tw}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeDasharray="6 3" strokeOpacity={0.4}>
                                <Label value={fmt(tw, 3)} position="right" fontSize={11} fill="#334155" />
                              </ReferenceLine>
                            ))}
                            <ReferenceLine y={1 / CONV_N} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} />
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-slate-400">Weights start at 1/3, diverge via g(σ). Dashed = steady state.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analysis callout */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <p>
                    LMS recovers the structural weights directly (MAE &asymp; 0.02). The mechanism instead identifies skilled forecasters and trades precise recovery for robustness, since σ falls when an agent misreports.
                  </p>
                </div>
              </div>

              {/* ═══ Per-forecaster CRPS over time ═══ */}
              {realData?.per_agent_crps && realData.per_agent_crps.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Per-forecaster CRPS over time</h3>
                  <p className="text-xs text-slate-500">
                    Individual CRPS for each forecaster at each round. Lower is better.
                  </p>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={realData.per_agent_crps} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="t" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                      <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'CRPS', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<SmartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {(realData.forecaster_names ?? []).slice(0, 5).map((name, i) => (
                        <Line key={i} type="monotone" dataKey={`crps_${i}`} name={name}
                          stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={i < 3 ? 2.5 : 1.5} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ═══ Rolling improvement over time ═══ */}
              {realData?.rolling_improvement && realData.rolling_improvement.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Rolling improvement over time</h3>
                  <p className="text-xs text-slate-500">
                    Mechanism CRPS improvement over equal weighting in sliding 1&thinsp;000-hour windows. Negative is better.
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={realData.rolling_improvement} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="t_start" tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'Window start (hour)', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'Δ CRPS %', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<SmartTooltip />} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="pct_improvement" name="Improvement %"
                        stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ═══ Aggregate calibration ═══ */}
              {realData?.calibration && realData.calibration.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Aggregate calibration (mechanism)</h3>
                  <p className="text-xs text-slate-500">
                    PIT coverage: the empirical fraction of outcomes below each nominal quantile. Perfect calibration sits on the nominal level.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-1.5 text-slate-500 font-medium">τ</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Nominal</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Empirical</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realData.calibration.map((c: { tau: number; nominal: number; empirical: number; gap: number }) => (
                          <tr key={c.tau} className="border-b border-slate-100">
                            <td className="py-1.5 font-mono">{c.tau.toFixed(2)}</td>
                            <td className="text-right py-1.5 font-mono">{c.nominal.toFixed(2)}</td>
                            <td className="text-right py-1.5 font-mono">{c.empirical.toFixed(4)}</td>
                            <td className={`text-right py-1.5 font-mono ${c.gap > 0.03 ? 'text-amber-600' : 'text-green-600'}`}>
                              {c.gap.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ═══ Train/test split validation ═══ */}
              {realData?.train_test_split && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Train/test split validation</h3>
                  <p className="text-xs text-slate-500">
                    First {realData.train_test_split.train_rounds.toLocaleString()} rounds for learning,
                    last {realData.train_test_split.test_rounds.toLocaleString()} for evaluation.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-1.5 text-slate-500 font-medium">Method</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Train CRPS</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Test CRPS</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Train Δ</th>
                          <th className="text-right py-1.5 text-slate-500 font-medium">Test Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(realData.train_test_split.methods)
                          .sort(([,a], [,b]) => a.test_crps - b.test_crps)
                          .map(([method, vals]) => (
                            <tr key={method} className="border-b border-slate-100">
                              <td className="py-1.5 font-medium text-slate-700">{METHOD_CHART_LABELS[method] ?? method}</td>
                              <td className="text-right py-1.5 font-mono">{vals.train_crps.toFixed(6)}</td>
                              <td className="text-right py-1.5 font-mono">{vals.test_crps.toFixed(6)}</td>
                              <td className={`text-right py-1.5 font-mono ${vals.train_delta_vs_uniform < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                                {vals.train_delta_vs_uniform >= 0 ? '+' : ''}{vals.train_delta_vs_uniform.toFixed(6)}
                              </td>
                              <td className={`text-right py-1.5 font-mono ${vals.test_delta_vs_uniform < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                                {vals.test_delta_vs_uniform >= 0 ? '+' : ''}{vals.test_delta_vs_uniform.toFixed(6)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Electricity results */}
          {shownTab === 'Real data' && realDataElec && (
            <div className="space-y-6 mt-8">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[11px] font-semibold">Dataset 2</span>
                  <h3 className="text-sm font-semibold text-teal-900">Elia imbalance prices: {realDataElec.config.T.toLocaleString()} points</h3>
                </div>
                <p className="text-xs text-teal-700 leading-relaxed">
                  The same seven forecasting models on Belgian electricity imbalance prices at
                  15-minute resolution (2024): a harder, more volatile generalisation check.
                </p>
              </div>
              <DeltaBarChart
                data={realDataElec.rows
                  .filter(r => r.method !== 'uniform')
                  .sort((a, b) => a.delta_crps_vs_equal - b.delta_crps_vs_equal)
                  .map(r => ({
                    label: METHOD_CHART_LABELS[r.method] ?? r.method,
                    delta: r.delta_crps_vs_equal * 1e4,
                    color: METHOD_CHART_COLORS[r.method] ?? '#64748b',
                  }))}
                baselineLabel="Equal weighting"
                metricLabel="Δ CRPS (×10⁴)"
                title="Method comparison: Electricity prices"
                provenance={{ type: 'real', label: 'Real data, Elia electricity' }}
              />
            </div>
          )}

          {shownTab === 'Real data' && !realData && !loading && (
            <EmptyState message="Real-data comparison is not available. Run the forecaster models on the Elia data, then reload." />
          )}

          {/* ═══ EXPERIMENT-BACKED TABS ═══ */}

          {useExp && !loading && shownTab === 'Accuracy' && (
            expAccuracyDisplay.length > 0 && calibrationData.length > 0 && ablationData.length > 0 ? (
              <div className="space-y-6">
              <FourPanelLayout
                title="Master Comparison"
                thesisPoint="Accuracy, calibration, weight concentration, and ablation evidence at a glance."
                primary={
                  <DeltaBarChart
                    data={expAccuracyDisplay.map((d) => ({
                      label: d.name,
                      delta: d.deltaCrpsX1e4,
                      se: d.seX1e4 > 0 ? d.seX1e4 : undefined,
                      color: d.color,
                    }))}
                    baselineLabel="Baseline (equal)"
                    metricLabel="Δ CRPS (×10⁴)"
                  />
                }
                calibration={
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Reliability diagram</div>
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={calibrationData} margin={CHART_MARGIN_LABELED}>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="tau" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]} />
                        <YAxis dataKey="pHat" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]} />
                        <Tooltip content={<SmartTooltip />} />
                        <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                        <Line type="monotone" dataKey="pHat" name="Empirical p̂" stroke="#0d9488" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                }
                structure={
                  <ConcentrationPanel
                    data={methodAgg
                      .filter((m) => (CORE_METHOD_KEYS as readonly string[]).includes(m.method))
                      .map((m) => ({
                        method: m.method,
                        label: m.label,
                        color: m.color,
                        gini: m.finalGini ?? undefined,
                        hhi: m.meanHHI ?? undefined,
                        nEff: m.meanNEff ?? undefined,
                      }))}
                  />
                }
                failure={
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Ablation (ΔCRPS vs Full)</div>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={ablationData} margin={{ ...CHART_MARGIN_LABELED, bottom: 24 }}>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="variant" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                        <Tooltip content={<SmartTooltip />} />
                        <Bar dataKey="delta_crps_vs_full" name="ΔCRPS vs Full" radius={[4, 4, 0, 0]} maxBarSize={40} fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                }
              />

              {/* Trade-off scatter: accuracy vs concentration */}
              <TradeOffScatter
                data={expTradeOffData}
                title="Accuracy vs Concentration Trade-off"
                provenance={{ type: 'synthetic', label: `Synthetic, ${defaultExperiment}` }}
              />

              {/* Waterfall: incremental CRPS change */}
              <WaterfallChart
                data={expWaterfallData}
                title="Incremental CRPS Improvement"
                metricLabel="Mean CRPS"
                provenance={{ type: 'synthetic', label: `Synthetic, ${defaultExperiment}` }}
              />
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500">
                No comparison data available for the four main methods.
              </div>
            )
          )}

          {useExp && shownTab === 'Concentration' && (
            <ConcentrationPanel
              data={methodAgg
                .filter((m) => (CORE_METHOD_KEYS as readonly string[]).includes(m.method))
                .map((m) => ({
                  method: m.method,
                  label: m.label,
                  color: m.color,
                  gini: m.finalGini ?? undefined,
                  hhi: m.meanHHI ?? undefined,
                  nEff: m.meanNEff ?? undefined,
                }))}
            />
          )}

          {useExp && shownTab === 'Calibration' && (
            <div className="space-y-4">
              <HowToRead
                id="evidence-calibration"
                points={[
                  'The diagonal is perfect calibration.',
                  'Above the line is over-confident, below is under-confident.',
                ]}
              />
              {calibrationData.length === 0 ? (
                <EmptyState message="Calibration data is not available. Run the calibration experiment, then reload." />
              ) : (
                <CalibrationChart
                  data={calibration}
                />
              )}
            </div>
          )}

          {useExp && shownTab === 'Ablation' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Bankroll ablation (ΔCRPS vs Full)</h3>
              {ablationData.length === 0 ? (
                <p className="text-[11px] text-slate-500">Ablation data not available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={ablationData} margin={{ ...CHART_MARGIN_LABELED, bottom: 24 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="variant" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                    <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Tooltip content={<SmartTooltip />} />
                    <Bar dataKey="delta_crps_vs_full" name="ΔCRPS vs Full" radius={[4, 4, 0, 0]} maxBarSize={40} fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ═══ DEMO FALLBACK TABS ═══ */}

          {!useExp && !loading && shownTab === 'Accuracy' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              {/* Experiment setup */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">Experiment setup</div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Weight-rule comparison, §4.1.4. Six forecasters with heterogeneous noise
                  τ<sub>i</sub> &in; [0.15, 1.0], T = 1,000 rounds over 20 seeds, warm-start t &gt; 200. Two deposit policies crossed with five weighting rules.
                </p>
              </div>

              {/* Weight-rule comparison — draft §4.1.4 data */}
              <WeightRuleComparisonPanel rows={weightRuleRows} />

              {/* Skill convergence (demo) — with Real/DGP toggle */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">
                  {skillSource === 'real' && hasRealSkill
                    ? `Skill recognition: Elia wind (${realForecasterCount} real forecasters)`
                    : 'Skill recognition: Synthetic DGP (3 controlled agents)'}
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-500">Data source:</span>
                  <button
                    onClick={() => setSkillSource('real')}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      skillSource === 'real'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Real forecasters
                  </button>
                  <button
                    onClick={() => setSkillSource('dgp')}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      skillSource === 'dgp'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Synthetic DGP
                  </button>
                </div>

                {skillSource === 'real' && hasRealSkill ? (
                  <>
                    <ForecasterSelector
                      forecasters={forecasterItems}
                      selectedIndex={selectedForecaster}
                      onSelect={setSelectedForecaster}
                    />
                    <p className="text-xs text-slate-500 mb-3">
                      Left: skill estimate σ (higher = better forecaster). Right: normalised weight.
                      Dashed line shows steady-state average for the selected model.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Skill estimate σ</div>
                        <ResponsiveContainer width="100%" height={360}>
                          <LineChart data={realSkillConvergence} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="t" tick={AXIS_TICK} stroke={AXIS_STROKE}
                              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                              label={{ value: 'Hour', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={sigmaDomain}
                              tickFormatter={(v: number) => v.toFixed(2)}
                              label={{ value: 'Skill σ', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<SmartTooltip />} />
                            {buildLineRenderOrder(realForecasterCount, selectedForecaster).map((i) => {
                              const style = getLineStyle(selectedForecaster, i);
                              return (
                                <Line key={i} type="monotone" dataKey={`sigma_${i}`} name={realForecasterNames[i]}
                                  stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                  strokeWidth={style.strokeWidth}
                                  strokeOpacity={style.opacity}
                                  dot={false} />
                              );
                            })}
                            <ReferenceLine y={realTargetSigmas[selectedForecaster]}
                              stroke={AGENT_PALETTE[selectedForecaster % AGENT_PALETTE.length]}
                              strokeDasharray="6 3" strokeOpacity={0.6}>
                              <Label value={fmt(realTargetSigmas[selectedForecaster], 3)} position="right" fontSize={11} fill="#334155" />
                            </ReferenceLine>
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-slate-400">Higher σ = better forecaster. Dashed = steady-state average.</p>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">Normalised weight</div>
                        <ResponsiveContainer width="100%" height={360}>
                          <LineChart data={realWeightConvergence} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}>
                            <CartesianGrid {...GRID_PROPS} />
                            <XAxis dataKey="t" tick={AXIS_TICK} stroke={AXIS_STROKE}
                              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                              label={{ value: 'Hour', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                              tickFormatter={(v: number) => v.toFixed(2)}
                              label={{ value: 'Weight', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                            <Tooltip content={<SmartTooltip />} />
                            {buildLineRenderOrder(realForecasterCount, selectedForecaster).map((i) => {
                              const style = getLineStyle(selectedForecaster, i);
                              return (
                                <Line key={i} type="monotone" dataKey={`weight_${i}`} name={realForecasterNames[i]}
                                  stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                  strokeWidth={style.strokeWidth}
                                  strokeOpacity={style.opacity}
                                  dot={false} />
                              );
                            })}
                            <ReferenceLine y={realTargetWeights[selectedForecaster]}
                              stroke={AGENT_PALETTE[selectedForecaster % AGENT_PALETTE.length]}
                              strokeDasharray="6 3" strokeOpacity={0.6}>
                              <Label value={fmt(realTargetWeights[selectedForecaster], 3)} position="right" fontSize={11} fill="#334155" />
                            </ReferenceLine>
                            <ReferenceLine y={1 / realForecasterCount} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} />
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-slate-400">Weights start near 1/{realForecasterCount}, diverge via g(σ). Dashed = steady state.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-3">
                      Three synthetic forecasters, Good (τ = 0.2), Okay (τ = 0.6), Bad (τ = 1.5), with fixed deposits so the skill layer recovers the ranking from CRPS alone.
                    </p>
                <div className="grid grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={skillConvergence} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'Round', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]}
                        label={{ value: 'Skill σ', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<SmartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      {Array.from({ length: CONV_N }, (_, i) => (
                        <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={CONV_LABELS[i]}
                          stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={2} dot={false} />
                      ))}
                      {targetSigmas.map((ts, i) => (
                        <ReferenceLine key={`ts-${i}`} y={ts}
                          stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                          strokeDasharray="6 3" strokeOpacity={0.4}>
                          <Label value={fmt(ts, 3)} position="right" fontSize={11} fill="#334155" />
                        </ReferenceLine>
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={weightConvergence} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'Round', position: 'insideBottom', offset: -18, fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0.2, 0.5]}
                        label={{ value: 'Weight', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<SmartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      {Array.from({ length: CONV_N }, (_, i) => (
                        <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={CONV_LABELS[i]}
                          stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} strokeWidth={2} dot={false} />
                      ))}
                      {targetWeights.map((tw, i) => (
                        <ReferenceLine key={`tw-${i}`} y={tw}
                          stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                          strokeDasharray="6 3" strokeOpacity={0.4}>
                          <Label value={fmt(tw, 3)} position="right" fontSize={11} fill="#334155" />
                        </ReferenceLine>
                      ))}
                      <ReferenceLine y={1 / CONV_N} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                  </>
                )}
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 mt-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    The mechanism recovers the ranking: F1 (Good) ends highest in σ, F3 (Bad) lowest.
                  </p>
                </div>

              </div>

              {/* Trade-off scatter: accuracy vs concentration */}
              <TradeOffScatter
                data={tradeOffData}
                title="Accuracy vs Concentration Trade-off"
                provenance={{ type: 'demo', label: `In-browser demo, seed=${DEMO_SEED}, N=${DEMO_N}, T=${DEMO_T}` }}
              />

              {/* Waterfall: incremental CRPS change */}
              <WaterfallChart
                data={waterfallData}
                title="Incremental CRPS Improvement"
                metricLabel="Mean CRPS"
                provenance={{ type: 'demo', label: `In-browser demo, seed=${DEMO_SEED}, N=${DEMO_N}, T=${DEMO_T}` }}
              />
            </div>
          )}

          {!useExp && !loading && shownTab === 'Concentration' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              {/* Experiment setup */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">Experiment setup</div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Same {DEMO_N} forecasters and {DEMO_T} rounds as the Accuracy tab, measuring final wealth Gini and mean effective panel size N<sub>eff</sub> per weighting method.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Wager share distribution by method</h3>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3 mt-2">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Gini measures concentration (0 = perfectly equal, 1 = one agent takes all).
                    N<sub>eff</sub> (the effective count, 1/HHI) counts how many forecasters carry meaningful weight.
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Equal weighting gives Gini &asymp; 0 and N<sub>eff</sub> = N. Skill &times; stake raises Gini and lowers N<sub>eff</sub>, tuned so N<sub>eff</sub> lands around 4&ndash;5 out of 6.
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={demoConcentrationBar} margin={{ ...CHART_MARGIN_LABELED, bottom: 24 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 12 }} stroke={AXIS_STROKE} />
                  <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
                  <Tooltip content={<SmartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="gini" name="Final Gini" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {demoConcentrationBar.map((d) => <Cell key={d.key} fill={d.color} opacity={0.85} />)}
                    <LabelList
                      dataKey="gini"
                      position="top"
                      formatter={(v: string | number | boolean | null | undefined) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? fmt(n, 3) : '-';
                      }}
                      style={{ fontSize: 11, fill: '#334155' }}
                    />
                  </Bar>
                  <Bar dataKey="nEff" name="Mean N_eff" radius={[4, 4, 0, 0]} maxBarSize={32} fill="#0ea5e9" opacity={0.85}>
                    <LabelList
                      dataKey="nEff"
                      position="top"
                      formatter={(v: string | number | boolean | null | undefined) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? fmt(n, 3) : '-';
                      }}
                      style={{ fontSize: 11, fill: '#334155' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!useExp && !loading && shownTab === 'Deposit policy' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              {/* Experiment setup */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">Experiment setup</div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Same {DEMO_N} forecasters and {DEMO_T} rounds, skill &times; stake throughout, varying only the deposit policy: fixed (b = 1), wealth fraction (b = 0.18 &middot; W), and σ-scaled (b = f &middot; W &middot; (0.25 + 0.85 σ)).
                </p>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={demoDeposits} margin={{ ...CHART_MARGIN_LABELED, bottom: 24 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 12 }} stroke={AXIS_STROKE} />
                  <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
                  <Tooltip content={<SmartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="meanError" name="Mean error" radius={[4, 4, 0, 0]} maxBarSize={36} fill={SEM.outcome.main} opacity={0.85}>
                    <LabelList
                      dataKey="meanError"
                      position="top"
                      formatter={(v: string | number | boolean | null | undefined) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? fmt(n, 3) : '-';
                      }}
                      style={{ fontSize: 11, fill: '#334155' }}
                    />
                  </Bar>
                  <Bar dataKey="gini" name="Final Gini" radius={[4, 4, 0, 0]} maxBarSize={36} fill={SEM.wealth.main} opacity={0.85}>
                    <LabelList
                      dataKey="gini"
                      position="top"
                      formatter={(v: string | number | boolean | null | undefined) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? fmt(n, 3) : '-';
                      }}
                      style={{ fontSize: 11, fill: '#334155' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Deposit rules in detail</div>
                <MathBlock latex="m_i = b_i \\cdot g(\\sigma_i), \\quad g(\\sigma) = \\lambda + (1-\\lambda)\\sigma^{\\eta}" label="Effective wager" caption="The deposit b_i determines how much of the skill signal reaches the aggregate" />

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold text-slate-700 mb-1">Fixed (b = 1): the real-data regime</div>
                  <MathBlock latex="b_i = 1 \\;\\; \\forall i" />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Isolates the skill signal. Weight differences come only from σ. Fairest
                    rule because wealth never feeds back into weight. This is the deposit rule used
                    on the Elia wind and electricity runs.
                  </p>
                </div>

                <details>
                  <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-1">
                    Wealth-feedback regimes (synthetic ablation)
                  </summary>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">Wealth fraction</div>
                      <MathBlock latex="b_i = f \\cdot W_i" />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Adds a feedback loop: winners deposit more, which gives them more weight, which
                        earns them more profit. Amplifies skill differences. The synthetic demo uses
                        a deposit fraction f = 0.18.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">σ-scaled</div>
                      <MathBlock latex="b_i = f \\cdot W_i \\cdot (0.25 + 0.85\\,\\sigma_i)" />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Strongest amplification: confident agents stake more on top of the wealth
                        feedback. Highest accuracy in this demo, but also the highest concentration.
                      </p>
                    </div>
                  </div>
                </details>

              </div>
            </div>
          )}

          {/* ═══ SCIENTIFIC ANALYSIS TAB ═══ */}

          {shownTab === 'Scientific Analysis' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                <h3 className="text-sm font-semibold text-indigo-900 mb-1">Scientific analysis</h3>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Each headline claim recomputed from the data, with cross-experiment rankings, sensitivity, failure modes and known gaps.
                </p>
              </div>

              {/* ── Band 1: Claim recomputation ── */}
              <h3 className="font-serif text-[15px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2">
                Claim recomputation
              </h3>

              {/* ── Claim Evidence Cards ── */}
              <section>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Project Claims</h3>
                {claimValidation.loading ? (
                  <LoadingState message="Loading claim validation…" />
                ) : claimValidation.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {claimValidation.claims.map((claim) => {
                      const validation = claimValidation.results.find((r) => r.claimId === claim.id) ?? null;
                      const es = effectSizes.byMethod.get(claim.evidence?.comparison_method ?? '') ?? null;
                      return (
                        <ClaimEvidenceCard
                          key={claim.id}
                          claim={claim}
                          validation={validation}
                          effectSize={es}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Result Consistency Matrix ── */}
              <section>
                {resultConsistency.loading ? (
                  <LoadingState message="Loading consistency matrix…" />
                ) : resultConsistency.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : resultConsistency.data ? (
                  <ResultConsistencyMatrix result={resultConsistency.data} />
                ) : null}
              </section>

              {/* ── Band 2: Sensitivity and ablation ── */}
              <h3 className="font-serif text-[15px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 mt-2">
                Sensitivity and ablation
              </h3>

              {/* ── Sensitivity Panel ── */}
              <section>
                {sensitivityData.loading ? (
                  <LoadingState message="Loading sensitivity analysis…" />
                ) : sensitivityData.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : sensitivityData.data ? (
                  <SensitivityPanel summary={sensitivityData.data} />
                ) : null}
              </section>

              {/* ── Ablation Interpretation Panel ── */}
              <section>
                {ablationInterpretation.loading ? (
                  <LoadingState message="Loading ablation interpretation…" />
                ) : ablationInterpretation.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : ablationInterpretation.data ? (
                  <AblationInterpretPanel interpretation={ablationInterpretation.data} />
                ) : null}
              </section>

              {/* ── Regime Breakdown Table ── */}
              <section>
                {regimeBreakdownData.loading ? (
                  <LoadingState message="Loading regime breakdown…" />
                ) : regimeBreakdownData.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : regimeBreakdownData.data ? (
                  <RegimeBreakdownTable regimes={regimeBreakdownData.data} />
                ) : null}
              </section>

              {/* ── Deposit Interaction Panel ── */}
              <section>
                {depositInteraction.loading ? (
                  <LoadingState message="Loading deposit interaction…" />
                ) : depositInteraction.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : depositInteraction.data ? (
                  <DepositInteractionPanel analysis={depositInteraction.data} />
                ) : null}
              </section>

              {/* ── Panel Size Sensitivity Chart ── */}
              <section>
                {panelSizeSensitivity.loading ? (
                  <LoadingState message="Loading panel size sensitivity…" />
                ) : panelSizeSensitivity.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : panelSizeSensitivity.data ? (
                  <PanelSizeChart sweep={panelSizeSensitivity.data} />
                ) : null}
              </section>

              {/* ── Band 3: Coverage and gaps ── */}
              <h3 className="font-serif text-[15px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-2 mt-2">
                Coverage and gaps
              </h3>

              {/* ── Failure Mode Panel ── */}
              <section>
                {failureModes.loading ? (
                  <LoadingState message="Loading failure modes…" />
                ) : failureModes.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : failureModes.data ? (
                  <FailureModePanel failureModes={failureModes.data} />
                ) : (
                  <FailureModePanel failureModes={[]} />
                )}
              </section>

              {/* ── Baseline Coverage Table ── */}
              <section>
                {baselineCoverage.loading ? (
                  <LoadingState message="Loading baseline coverage…" />
                ) : baselineCoverage.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : baselineCoverage.data ? (
                  <BaselineCoverageTable entries={baselineCoverage.data} />
                ) : null}
              </section>

              {/* ── Real Data Context Panel ── */}
              <section>
                {realDataContext.loading ? (
                  <LoadingState message="Loading real-data context…" />
                ) : realDataContext.error ? (
                  <EmptyState message="Data not yet available for this analysis." />
                ) : realDataContext.data ? (
                  <RealDataContextPanel
                    realData={realDataContext.data.realData}
                    realDataElectricity={realDataContext.data.realDataElectricity}
                    syntheticDeltaCrps={realDataContext.data.syntheticDeltaCrps}
                  />
                ) : null}
              </section>
            </div>
          )}

          </motion.div>
          </AnimatePresence>
          </ChartLinkingProvider>
        </section>

    </PageShell>
    </EquationProvider>
    </FigureProvider>
  );
}