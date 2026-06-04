import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Card, StatTile, SectionHeading, Tag } from '@/components/platform/ui';
import StoryNav from '@/components/platform/StoryNav';
import TrajectoryChart from '@/components/platform/viz/TrajectoryChart';
import ChartScroller from '@/components/platform/viz/ChartScroller';
import ReliabilityDiagram from '@/components/platform/viz/ReliabilityDiagram';
import Sparkline from '@/components/platform/viz/Sparkline';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { useMarketSimulation } from '@/components/platform/hooks/useMarketSimulation';
import {
  bankrollSeries,
  skillSeries,
  profitSeries,
  scoreSeries,
  calibrationCurve,
  rollupPanel,
} from '@/components/platform/derivedMetrics';
import { TYPE, SPACE } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import { forecasterColour, forecasterLabel } from '@/components/platform/forecasterIdentity';

/**
 * Personal dashboard ("My account"). For one forecaster in a running synthetic
 * panel: bankroll over rounds (wealth_after), skill σ trajectory (sigma_new),
 * a calibration view of their own quantile reports, recent round history
 * (deposit, wager, score, payoff, profit), and their leaderboard standing.
 *
 * The visitor picks which panel seat to inspect. Every series is a per-row
 * slice of the trace array (derivedMetrics.ts); nothing is recomputed.
 */
export default function AccountPage() {
  const { result, config } = useMarketSimulation({ rounds: 80 });
  const traces = result.traces;
  // The leaderboard deep-links here with ?seat=<index> so clicking a forecaster
  // opens their seat, not the default. Clamp to the panel; absent or out-of-range
  // falls back to seat 0, byte-identical to the prior default.
  const [searchParams] = useSearchParams();
  const initialSeat = (() => {
    const raw = Number.parseInt(searchParams.get('seat') ?? '', 10);
    return Number.isInteger(raw) && raw >= 0 && raw < config.n ? raw : 0;
  })();
  const [seat, setSeat] = useState(initialSeat);

  const bankroll = useMemo(() => bankrollSeries(traces, seat), [traces, seat]);
  const skill = useMemo(() => skillSeries(traces, seat), [traces, seat]);
  const profit = useMemo(() => profitSeries(traces, seat), [traces, seat]);
  const scores = useMemo(() => scoreSeries(traces, seat), [traces, seat]);
  const calibration = useMemo(() => calibrationCurve(traces, seat), [traces, seat]);
  const rollups = useMemo(() => rollupPanel(traces, config.n), [traces, config.n]);

  const sorted = useMemo(() => [...rollups].sort((a, b) => b.sigma - a.sigma), [rollups]);
  const rank = sorted.findIndex((r) => r.index === seat) + 1;
  const me = rollups[seat];
  const colour = forecasterColour(seat);

  // Recent round history (last 8) from the trace fields directly.
  const recent = useMemo(() => {
    const rows = traces.map((t, i) => ({
      round: i + 1,
      deposit: t.deposits[seat] ?? 0,
      wager: t.effectiveWager[seat] ?? 0,
      score: t.scores[seat] ?? 0,
      payoff: t.totalPayoff[seat] ?? 0,
      profit: t.profit[seat] ?? 0,
    }));
    return rows.slice(-8).reverse();
  }, [traces, seat]);

  return (
    <PlatformLayout>
      <SectionHeading
        as={1}
        eyebrow="My account"
        title={`${forecasterLabel(seat)} - track record`}
        subtitle="Consistent quality compounds: a good track record lifts your skill, your weight, and your share of the pool."
        companion={<ThesisRef viewKey="platform/account" />}
        actions={
          <div>
            <p className="eyebrow" style={controlEyebrow}>Inspect forecaster</p>
            <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap' }}>
            {Array.from({ length: config.n }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSeat(i)}
                aria-pressed={i === seat}
                style={{
                  minHeight: 40,
                  minWidth: 44,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: `1px solid ${i === seat ? forecasterColour(i) : 'var(--border)'}`,
                  background: i === seat ? forecasterColour(i) : 'transparent',
                  color: i === seat ? 'var(--paper)' : 'var(--ink-soft)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: TYPE.label.size,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {forecasterLabel(i)}
              </button>
            ))}
            </div>
          </div>
        }
      />

      <SectionHeading level={3} as={2} eyebrow="At a glance" title="This forecaster" className="mt-8" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: SPACE[4],
          marginTop: SPACE[4],
        }}
      >
        <StatTile label="Wealth" value={me ? me.wealth.toFixed(2) : '0'} accent="wealth" sublabel="latest W" />
        <StatTile label="Skill &sigma;" value={me ? me.sigma.toFixed(3) : '0'} accent="skill" sublabel="latest &sigma;" />
        <StatTile label="Leaderboard rank" value={`#${rank}`} accent="aggregate" sublabel={`of ${config.n} by skill`} />
        <StatTile label="Pool share" value={me ? `${(me.poolShare * 100).toFixed(1)}` : '0'} unit="%" accent="payoff" sublabel="&Sigma;&pi; / &Sigma;M" />
        <StatTile label="Skill premium" value={me ? `${(me.skillPremium * 100).toFixed(2)}` : '0'} unit="%" accent="score" sublabel="pool &minus; wager share" />
      </div>

      <div
        className="account-grid"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: SPACE[6], marginTop: SPACE[8], alignItems: 'start' }}
      >
        <Card elevation="raised" padding="roomy">
          <h3 style={cardHeading}>Bankroll and skill over rounds</h3>
          <ChartScroller label="Bankroll over rounds">
            <TrajectoryChart
              ariaLabel="Bankroll over rounds"
              series={[{ label: 'wealth', data: bankroll, colour: SEM.wealth.main }]}
              yLabel="wealth W"
              reference={{ value: 20, label: 'start' }}
              data-testid="bankroll-chart"
            />
          </ChartScroller>
          <div style={{ marginTop: SPACE[5] }}>
            <ChartScroller label="Skill sigma over rounds">
              <TrajectoryChart
                ariaLabel="Skill sigma over rounds"
                series={[{ label: 'σ', data: skill, colour: SEM.skill.main }]}
                yDomain={[0, 1]}
                yLabel="skill σ"
                reference={{ value: 0.1, label: 'σ_min' }}
              />
            </ChartScroller>
          </div>
        </Card>

        <Card elevation="raised" padding="roomy">
          <h3 style={cardHeading}>Calibration of your forecasts</h3>
          <ReliabilityDiagram points={calibration} accent={colour} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: `${SPACE[3]}px 0 0` }}>
            Empirical coverage of each quantile level against nominal &tau;. On the
            45&deg; diagonal means perfectly calibrated; above means the forecasts
            over-cover, below means they under-cover.
          </p>
        </Card>
      </div>

      <SectionHeading level={3} title="Recent rounds" className="mt-12" />
      <Card padding="default" style={{ marginTop: SPACE[5], overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size }}>
          <thead>
            <tr style={{ textAlign: 'right', color: 'var(--ink-soft)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ textAlign: 'left', padding: SPACE[2] }}>Round</th>
              <th style={thNum}>Deposit b</th>
              <th style={thNum}>Wager m</th>
              <th style={thNum}>Score s</th>
              <th style={thNum}>Payoff &Pi;</th>
              <th style={thNum}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.round} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ textAlign: 'left', padding: SPACE[2], fontVariantNumeric: 'tabular-nums' }}>{r.round}</td>
                <td style={tdNum}>{r.deposit.toFixed(2)}</td>
                <td style={tdNum}>{r.wager.toFixed(2)}</td>
                <td style={tdNum}>{r.score.toFixed(3)}</td>
                <td style={tdNum}>{r.payoff.toFixed(2)}</td>
                <td style={{ ...tdNum, color: r.profit >= 0 ? SEM.payoff.main : SEM.outcome.main, fontWeight: 600 }}>
                  {r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: SPACE[6], marginTop: SPACE[5], flexWrap: 'wrap' }}>
          <div>
            <p style={miniLabel}>Profit history</p>
            <Sparkline data={profit} colour={colour} zeroBaseline ariaLabel="Profit history sparkline" width={200} height={48} />
          </div>
          <div>
            <p style={miniLabel}>Score history</p>
            <Sparkline data={scores} colour={SEM.score.main} ariaLabel="Score history sparkline" width={200} height={48} />
          </div>
        </div>
      </Card>

      <div style={{ marginTop: SPACE[6] }}>
        <Tag tone="caution" size="sm">Synthetic sandbox panel</Tag>
      </div>

      <StoryNav current={3} />

      <style>{`
        @media (max-width: 1024px) {
          /* minmax(0, 1fr): the chart cards' min-content would otherwise
             force the single column wider than a phone viewport. */
          .account-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </PlatformLayout>
  );
}

const cardHeading: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: TYPE.h3.size, fontWeight: 600, color: 'var(--ink)', margin: `0 0 ${SPACE[4]}px` };
const thNum: React.CSSProperties = { textAlign: 'right', padding: SPACE[2] };
const tdNum: React.CSSProperties = { textAlign: 'right', padding: SPACE[2], fontVariantNumeric: 'tabular-nums' };
const miniLabel: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: TYPE.label.size, fontWeight: 600, color: 'var(--ink-soft)', margin: `0 0 ${SPACE[2]}px`, textTransform: 'uppercase', letterSpacing: '0.08em' };
const controlEyebrow: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: TYPE.label.size, fontWeight: 600, color: 'var(--teal-deep)', margin: `0 0 ${SPACE[2]}px`, textTransform: 'uppercase', letterSpacing: '0.12em' };
