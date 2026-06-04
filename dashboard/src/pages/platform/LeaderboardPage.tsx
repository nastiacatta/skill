import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Card, SectionHeading, Tag, Button } from '@/components/platform/ui';
import StoryNav from '@/components/platform/StoryNav';
import Sparkline from '@/components/platform/viz/Sparkline';
import ThesisRef from '@/components/dashboard/ThesisRef';
import HowToRead from '@/components/dashboard/HowToRead';
import { useMarketSimulation } from '@/components/platform/hooks/useMarketSimulation';
import { rollupPanel, profitSeries, type ForecasterRollup } from '@/components/platform/derivedMetrics';
import { TYPE, SPACE, TRANSITION } from '@/components/platform/designTokens';
import { forecasterColour, forecasterLabel } from '@/components/platform/forecasterIdentity';

/**
 * Marketplace / leaderboard. The whole synthetic panel ranked by skill, wealth,
 * recent mean score, pool share, wager share, skill premium, with a profit
 * sparkline. Sortable by any column; rows carry the forecaster's colour.
 *
 * A static, clearly-labelled "real-panel preview" shows the verified Elia wind
 * σ ordering (claim C8) as precomputed reference - it cannot be reproduced live
 * at the headline params in-browser (do-not-claim #8).
 */
type SortKey = 'sigma' | 'wealth' | 'meanScore' | 'poolShare' | 'wagerShare' | 'skillPremium';

const COLUMNS: { key: SortKey; label: string; fmt: (r: ForecasterRollup) => string }[] = [
  { key: 'sigma', label: 'Skill σ', fmt: (r) => r.sigma.toFixed(3) },
  { key: 'wealth', label: 'Wealth W', fmt: (r) => r.wealth.toFixed(2) },
  { key: 'meanScore', label: 'Mean score', fmt: (r) => r.meanScore.toFixed(3) },
  { key: 'poolShare', label: 'Pool share', fmt: (r) => `${(r.poolShare * 100).toFixed(1)}%` },
  { key: 'wagerShare', label: 'Wager share', fmt: (r) => `${(r.wagerShare * 100).toFixed(1)}%` },
  { key: 'skillPremium', label: 'Skill premium', fmt: (r) => `${(r.skillPremium * 100).toFixed(2)}%` },
];

// Verified Elia wind tail-mean σ ordering (claim C8, comparison.json steady_state).
const ELIA_SIGMA: { name: string; sigma: number }[] = [
  { name: 'XGBoost', sigma: 0.80 },
  { name: 'ARIMA(2,1,1)', sigma: 0.79 },
  { name: 'Naive', sigma: 0.78 },
  { name: 'Neural Net (MLP)', sigma: 0.76 },
  { name: 'Ensemble (Naive+EWMA)', sigma: 0.74 },
  { name: 'EWMA(5)', sigma: 0.69 },
  { name: 'Theta', sigma: 0.67 },
];

export default function LeaderboardPage() {
  const { result, config } = useMarketSimulation({ rounds: 80 });
  const traces = result.traces;
  const [sortKey, setSortKey] = useState<SortKey>('sigma');
  const reduce = useReducedMotion();

  const rollups = useMemo(() => rollupPanel(traces, config.n), [traces, config.n]);
  const sorted = useMemo(() => [...rollups].sort((a, b) => b[sortKey] - a[sortKey]), [rollups, sortKey]);
  const profits = useMemo(() => rollups.map((r) => profitSeries(traces, r.index)), [rollups, traces]);

  return (
    <PlatformLayout>
      <SectionHeading
        as={1}
        eyebrow="Marketplace"
        title="The panel, ranked"
        subtitle="Skill ordering is recovered from data alone: the board ranks forecasters the way the mechanism learned to weight them. Sort by any column, then click through to a forecaster's account."
      />

      <HowToRead
        id="leaderboard-skill"
        points={[
          'Each row is one synthetic forecaster, ordered by the skill the mechanism inferred.',
          'The weight column is the share of the aggregate that forecaster earns. Better forecasters earn more.',
          'This panel is a synthetic sandbox for illustration. The real-data result is on Evidence.',
        ]}
      />

      <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginTop: SPACE[6] }}>
        {COLUMNS.map((c) => (
          <Button key={c.key} size="sm" variant={sortKey === c.key ? 'primary' : 'secondary'} onClick={() => setSortKey(c.key)}>
            Sort by {c.label}
          </Button>
        ))}
      </div>

      <Card padding="default" style={{ marginTop: SPACE[5], overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size }} data-testid="leaderboard-table">
          <thead>
            <tr style={{ color: 'var(--ink-soft)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ textAlign: 'left', padding: SPACE[2] }}>#</th>
              <th style={{ textAlign: 'left', padding: SPACE[2] }}>Forecaster</th>
              {COLUMNS.map((c) => (
                <th key={c.key} style={{ textAlign: 'right', padding: SPACE[2], color: sortKey === c.key ? 'var(--ink)' : 'var(--ink-soft)' }}>{c.label}</th>
              ))}
              <th style={{ textAlign: 'right', padding: SPACE[2] }}>Profit trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, rankIdx) => {
              const colour = forecasterColour(r.index);
              return (
                <motion.tr
                  key={r.index}
                  layout={reduce ? false : 'position'}
                  transition={TRANSITION.reorder}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  data-testid={`leaderboard-row-${r.index}`}
                >
                  <td style={{ padding: SPACE[2], fontVariantNumeric: 'tabular-nums', color: 'var(--ink-soft)' }}>{rankIdx + 1}</td>
                  <td style={{ padding: SPACE[2] }}>
                    <a href={`#/platform/account?seat=${r.index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: colour, display: 'inline-block' }} aria-hidden="true" />
                      {forecasterLabel(r.index)}
                    </a>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} style={{ textAlign: 'right', padding: SPACE[2], fontVariantNumeric: 'tabular-nums', fontWeight: c.key === sortKey ? 600 : 400 }}>
                      {c.fmt(r)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', padding: SPACE[2] }}>
                    <Sparkline data={profits[r.index]} colour={colour} zeroBaseline ariaLabel={`Profit trend for ${forecasterLabel(r.index)}`} width={160} height={44} />
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: SPACE[4] }}>
        <Tag tone="caution" size="sm">Synthetic sandbox panel</Tag>
      </div>

      <SectionHeading
        level={3}
        as={2}
        eyebrow="Reference &middot; real Elia panel"
        title="What the mechanism learned on Elia wind"
        subtitle="The verified steady-state skill ordering on offshore wind. This is a precomputed artefact at the real-data parameters. It cannot be reproduced live in this synthetic sandbox."
        companion={<ThesisRef viewKey="platform/leaderboard" />}
        className="mt-12"
      />
      <Card padding="default" style={{ marginTop: SPACE[5] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], marginBottom: SPACE[4] }}>
          <Tag tone="info" size="sm">Elia wind, precomputed</Tag>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)' }}>
            Spearman(&sigma;, CRPS) = &minus;1.00 &middot; tail-mean &sigma;
          </span>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          {ELIA_SIGMA.map((f, i) => {
            const colour = forecasterColour(i);
            return (
              <li key={f.name} style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
                <span style={{ width: 28, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)' }}>{i + 1}</span>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: colour, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ flex: '2 1 96px', minWidth: 0, fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                <span style={{ flex: '3 1 60px', height: 18, background: 'var(--cream)', borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${f.sigma * 100}%`, background: colour, opacity: 0.55 }} />
                </span>
                <span style={{ width: 56, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: TYPE.body.size, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{f.sigma.toFixed(2)}</span>
              </li>
            );
          })}
        </ol>
        <p style={{ marginTop: SPACE[4] }}>
          <a href="#/evidence" style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--imperial)' }}>See the wind evidence (C8 σ ordering)</a>
        </p>
      </Card>

      <StoryNav current={4} />
    </PlatformLayout>
  );
}
