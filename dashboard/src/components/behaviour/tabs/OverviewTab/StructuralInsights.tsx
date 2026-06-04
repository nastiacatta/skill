/**
 * StructuralInsights — data-driven insight cards.
 *
 * Replaces the hardcoded INSIGHTS array in OverviewTab.
 * Derives verdict (good/neutral/bad) from actual summary and familyImpact data.
 */

import { VERDICT_COLOURS } from '@/lib/palette';
import type { ComparisonRow, FamilyImpactDatum } from '@/hooks/useBehaviourSimulations';
import type { Verdict } from '@/lib/behaviour/helpers';

// ── Insight definitions ────────────────────────────────────────────────────

interface InsightDef {
  title: string;
  detail: (ctx: InsightContext) => string;
  verdict: (ctx: InsightContext) => Verdict;
}

interface InsightContext {
  summary: ComparisonRow[];
  familyImpact: FamilyImpactDatum[];
  /** Helper: find a row by presetId */
  row: (presetId: string) => ComparisonRow | undefined;
  /** Helper: find family impact by family name */
  family: (name: string) => FamilyImpactDatum | undefined;
  /** Helper: get all rows for a family */
  familyRows: (name: string) => ComparisonRow[];
}

function buildContext(
  summary: ComparisonRow[],
  familyImpact: FamilyImpactDatum[],
): InsightContext {
  return {
    summary,
    familyImpact,
    row: (id: string) => summary.find(r => r.presetId === id),
    family: (name: string) => familyImpact.find(f => f.family === name),
    familyRows: (name: string) => summary.filter(r => r.family === name),
  };
}

const INSIGHT_DEFS: InsightDef[] = [
  {
    title: 'Participation dominates accuracy',
    detail: (ctx) => {
      const bursty = ctx.row('bursty');
      const delta = bursty ? `${bursty.deltaCrpsPct.toFixed(0)}%` : 'N/A';
      const part = bursty ? `${(bursty.participation * 100).toFixed(0)}%` : 'N/A';
      return `Bursty at ${part} participation degrades CRPS by ${delta}. Missing agents = missing information. The mechanism preserves σ but can't compensate for absent signals.`;
    },
    verdict: (ctx) => {
      const bursty = ctx.row('bursty');
      return bursty && bursty.deltaCrpsPct > 100 ? 'bad' : 'neutral';
    },
  },
  {
    title: 'Quantile distortions are the real threat',
    detail: (ctx) => {
      const reporting = ctx.familyRows('reporting')
        .filter(r => r.presetId !== 'baseline')
        .sort((a, b) => b.deltaCrpsPct - a.deltaCrpsPct);
      const info = ctx.familyRows('information')
        .filter(r => r.presetId !== 'baseline')
        .sort((a, b) => b.deltaCrpsPct - a.deltaCrpsPct);
      const worst = [...reporting, ...info].sort((a, b) => b.deltaCrpsPct - a.deltaCrpsPct);
      const top = worst.slice(0, 4).map(r => `${r.name} +${r.deltaCrpsPct.toFixed(0)}%`).join(', ');
      const manipDelta = ctx.row('manipulator')?.deltaCrpsPct ?? 0;
      return `Reporting attacks that distort quantile forecasts (${top}) are far more damaging than point-forecast manipulation (+${manipDelta.toFixed(1)}%).`;
    },
    verdict: (ctx) => {
      const reportingImpact = ctx.family('reporting');
      const infoImpact = ctx.family('information');
      const maxDelta = Math.max(
        Math.abs(reportingImpact?.worstDeltaCrpsPct ?? 0),
        Math.abs(infoImpact?.worstDeltaCrpsPct ?? 0),
      );
      return maxDelta > 15 ? 'bad' : 'neutral';
    },
  },
  {
    title: 'Point-forecast attacks are contained',
    detail: (ctx) => {
      const manip = ctx.row('manipulator');
      const evader = ctx.row('evader');
      const repReset = ctx.row('reputation_reset');
      const parts = [
        manip ? `Manipulator (+${manip.deltaCrpsPct.toFixed(1)}%)` : null,
        evader ? `evader (+${evader.deltaCrpsPct.toFixed(1)}%)` : null,
        repReset ? `rep. reset (+${repReset.deltaCrpsPct.toFixed(1)}%)` : null,
      ].filter(Boolean).join(', ');
      return `${parts}: the skill gate downweights point-forecast attackers within rounds.`;
    },
    verdict: (ctx) => {
      const manip = ctx.row('manipulator');
      return manip && manip.deltaCrpsPct < 5 ? 'good' : 'neutral';
    },
  },
  {
    title: 'Multi-agent coordination amplifies impact',
    detail: (ctx) => {
      const sybil = ctx.row('sybil');
      const collusion = ctx.row('collusion');
      const sybilDelta = sybil ? `+${sybil.deltaCrpsPct.toFixed(0)}%` : 'N/A';
      const collusionDelta = collusion ? `+${collusion.deltaCrpsPct.toFixed(0)}%` : 'N/A';
      return `Sybil ${sybilDelta}, Collusion ${collusionDelta}. Coordinated behaviour exceeds what the skill gate absorbs. But narrow Lambert sybil invariance holds (clone pair wealth ratio ≤ 1.05).`;
    },
    verdict: (ctx) => {
      const sybil = ctx.row('sybil');
      const collusion = ctx.row('collusion');
      const maxDelta = Math.max(
        sybil?.deltaCrpsPct ?? 0,
        collusion?.deltaCrpsPct ?? 0,
      );
      return maxDelta > 5 ? 'neutral' : 'good';
    },
  },
  {
    title: 'Staking strategy has mixed effects',
    detail: (ctx) => {
      const kelly = ctx.row('kelly_sizer');
      const house = ctx.row('house_money');
      const budget = ctx.row('budget_constrained');
      const parts = [
        kelly ? `Kelly +${kelly.deltaCrpsPct.toFixed(0)}% (overconfident sizing hurts)` : null,
        house ? `House-money ${house.deltaCrpsPct.toFixed(1)}% (winners get more weight ${house.deltaCrpsPct < 0 ? 'helps' : 'hurts'})` : null,
        budget ? `Budget +${budget.deltaCrpsPct.toFixed(1)}% (no ruin in 300 rounds)` : null,
      ].filter(Boolean).join(', ');
      return `${parts}.`;
    },
    verdict: (ctx) => {
      const stakingRows = ctx.familyRows('staking').filter(r => r.presetId !== 'baseline');
      const hasPositive = stakingRows.some(r => r.deltaCrpsPct > 0);
      const hasNegative = stakingRows.some(r => r.deltaCrpsPct < 0);
      return hasPositive && hasNegative ? 'neutral' : hasNegative ? 'good' : 'bad';
    },
  },
  {
    title: 'Latency exploitation is beneficial',
    detail: (ctx) => {
      const latency = ctx.row('latency_exploiter');
      const delta = latency ? `${latency.deltaCrpsPct.toFixed(1)}%` : 'N/A';
      return `Partial outcome info (${delta}) actually improves the aggregate. The exploiter's better-informed quantiles help everyone.`;
    },
    verdict: (ctx) => {
      const latency = ctx.row('latency_exploiter');
      return latency && latency.deltaCrpsPct < -1 ? 'good' : 'neutral';
    },
  },
];

// ── Component ──────────────────────────────────────────────────────────────

interface StructuralInsightsProps {
  summary: ComparisonRow[];
  familyImpact: FamilyImpactDatum[];
}

export default function StructuralInsights({
  summary,
  familyImpact,
}: StructuralInsightsProps) {
  const ctx = buildContext(summary, familyImpact);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Structural findings</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INSIGHT_DEFS.map((ins, i) => {
          const verdict = ins.verdict(ctx);
          const detail = ins.detail(ctx);
          return (
            <div
              key={i}
              className="rounded-xl border border-slate-200 border-l-4 p-4"
              style={{
                borderLeftColor: VERDICT_COLOURS[verdict].border,
                backgroundColor: VERDICT_COLOURS[verdict].bg,
              }}
            >
              <div
                className="text-[14px] font-bold mb-1"
                style={{ color: VERDICT_COLOURS[verdict].fg }}
              >
                {ins.title}
              </div>
              <p className="text-[14px] text-slate-600 leading-relaxed">{detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
