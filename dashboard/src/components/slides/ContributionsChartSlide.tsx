import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY, FIGURE_FRAME } from './shared/presentationConstants';

/* ── Types ─────────────────────────────────────────────────────── */

interface SkillHistoryRow {
  t: number;
  sigma_0: number;
  sigma_1: number;
  sigma_2: number;
  sigma_3: number;
  sigma_4: number;
  sigma_5: number;
  sigma_6: number;
}

/* ── Forecaster metadata ───────────────────────────────────────── */

export const FORECASTER_META = [
  { key: 'sigma_0', name: 'Naive',    colour: '#1B2A4A' },
  { key: 'sigma_1', name: 'EWMA',     colour: '#2E8B8B' },
  { key: 'sigma_2', name: 'ARIMA',    colour: '#E85D4A' },
  { key: 'sigma_3', name: 'XGBoost',  colour: '#7C3AED' },
  { key: 'sigma_4', name: 'MLP',      colour: '#E67E22' },
  { key: 'sigma_5', name: 'Theta',    colour: '#64748B' },
  { key: 'sigma_6', name: 'Ensemble', colour: '#003E74' },
] as const;

const BASE = import.meta.env.BASE_URL;
const WIND_URL = `${BASE}data/real_data/elia_wind/data/comparison.json`;

/* ── Pure opacity helpers (exported for testing) ───────────────── */

export function getLineOpacity(selected: number | null, lineIdx: number): number {
  if (selected === null) return 0.6;
  return lineIdx === selected ? 1.0 : 0.15;
}

export function getLineStrokeWidth(selected: number | null, lineIdx: number): number {
  if (selected === null) return 2;
  return lineIdx === selected ? 3 : 1.5;
}

/* ── Helper to extract skill_history rows ──────────────────────── */

function extractSkillHistory(json: Record<string, unknown>): SkillHistoryRow[] | null {
  const history = (json as { skill_history?: unknown })?.skill_history;
  if (!Array.isArray(history)) return null;
  return history.map((r: Record<string, number>) => ({
    t: r.t,
    sigma_0: r.sigma_0,
    sigma_1: r.sigma_1,
    sigma_2: r.sigma_2,
    sigma_3: r.sigma_3,
    sigma_4: r.sigma_4,
    sigma_5: r.sigma_5,
    sigma_6: r.sigma_6,
  }));
}

/* ── Component ─────────────────────────────────────────────────── */
/**
 * Slide 10 — Real Data. Consolidated to a single view:
 *   • Primary view: wind skill trajectories (the main result).
 *   • Highlight pills act as a filter, not a page change — "Highlight:" label
 *     makes that explicit so the slide never feels like 3 subslides.
 *   • Electricity is a small inset card, not a separate toggle, so the
 *     comparison is visible on the same slide.
 *   • CRPS and σ are defined inline, so the audience never sees a metric
 *     name without knowing what it is.
 */
export default function ContributionsChartSlide() {
  const [skillData, setSkillData] = useState<SkillHistoryRow[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetch(WIND_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const rows = extractSkillHistory(json);
        if (rows) setSkillData(rows);
        else setHasError(true);
      })
      .catch(() => setHasError(true));
  }, []);

  const handlePillClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setSelected((prev) => (prev === idx ? null : idx));
  };

  return (
    <SlideShell title="Real Data: Elia Wind + Electricity" slideNumber={10}>
      {/* ── Header row: headline number + CRPS/σ glossary ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'rgba(46, 139, 139, 0.08)',
            borderLeft: `5px solid ${PALETTE.teal}`,
            borderRadius: '0 10px 10px 0',
            padding: '14px 20px',
            fontFamily: TYPOGRAPHY.fontFamily,
            color: PALETTE.navy,
          }}
        >
          <div style={{ fontSize: '1.45rem', fontWeight: 700, lineHeight: 1.3 }}>
            Wind, 17,544 rounds: mechanism −7.1% CRPS vs equal weights.
          </div>
          <div style={{ fontSize: '1.15rem', color: PALETTE.charcoal, marginTop: 4, lineHeight: 1.4 }}>
            Skill ranks forecasters by realised loss; a per-round best-single still beats the aggregate.
          </div>
        </div>
        <div
          style={{
            width: 360,
            background: 'rgba(100, 116, 139, 0.08)',
            borderLeft: `4px solid ${PALETTE.slate}`,
            borderRadius: 4,
            padding: '12px 16px',
            fontFamily: TYPOGRAPHY.fontFamily,
            fontSize: '1.05rem',
            color: PALETTE.charcoal,
            lineHeight: 1.5,
            flexShrink: 0,
          }}
        >
          <strong style={{ color: PALETTE.navy }}>CRPS</strong> — proper score for probabilistic forecasts, lower is better.
          <br />
          <strong style={{ color: PALETTE.navy }}>σ</strong> — learned skill, 0–1, higher means better recent accuracy.
        </div>
      </div>

      {/* ── Highlight pills (filter, not subslide) ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: PALETTE.slate,
            fontFamily: TYPOGRAPHY.fontFamily,
            marginRight: 6,
          }}
        >
          Highlight:
        </span>
        {FORECASTER_META.map((meta, idx) => {
          const isSelected = selected === idx;
          return (
            <button
              key={meta.key}
              onClick={(e) => handlePillClick(e, idx)}
              style={{
                padding: '6px 18px',
                borderRadius: 999,
                border: `2px solid ${meta.colour}`,
                background: isSelected ? meta.colour : 'transparent',
                color: isSelected ? '#fff' : meta.colour,
                fontWeight: isSelected ? 700 : 600,
                fontSize: '1.05rem',
                fontFamily: TYPOGRAPHY.fontFamily,
                cursor: 'pointer',
                opacity: selected === null || isSelected ? 1 : 0.45,
                transition: 'all 0.15s ease',
              }}
            >
              {meta.name}
            </button>
          );
        })}
      </div>

      {/* ── Chart area (wind is the primary view) ── */}
      <div style={{ flex: 1, minHeight: 0, ...FIGURE_FRAME, position: 'relative' }}>
        {hasError ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: PALETTE.slate,
              fontSize: TYPOGRAPHY.body.fontSize, fontFamily: TYPOGRAPHY.fontFamily,
            }}
          >
            Data unavailable
          </div>
        ) : !skillData ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: PALETTE.slate,
              fontSize: TYPOGRAPHY.body.fontSize, fontFamily: TYPOGRAPHY.fontFamily,
            }}
          >
            Loading…
          </div>
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                top: 10, left: 24,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: PALETTE.navy,
                fontFamily: TYPOGRAPHY.fontFamily,
              }}
            >
              Learned skill σ over time — Elia wind
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={skillData} margin={{ top: 36, right: 36, bottom: 44, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="t"
                  label={{
                    value: 'Round',
                    position: 'insideBottom',
                    offset: -18,
                    style: { fontSize: 22, fontWeight: 600, fill: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily },
                  }}
                  tick={{ fontSize: 17, fontFamily: TYPOGRAPHY.fontFamily, fill: PALETTE.slate }}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.border }}
                  stroke={PALETTE.slate}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  label={{
                    value: 'Learned skill (σ)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 8,
                    style: { fontSize: 22, fontWeight: 600, fill: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, textAnchor: 'middle' },
                  }}
                  tick={{ fontSize: 17, fontFamily: TYPOGRAPHY.fontFamily, fill: PALETTE.slate }}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.border }}
                  stroke={PALETTE.slate}
                />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ stroke: PALETTE.slate, strokeDasharray: '3 3', strokeOpacity: 0.5 }}
                  contentStyle={{
                    fontFamily: TYPOGRAPHY.fontFamily,
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${PALETTE.border}`,
                    boxShadow: '0 4px 16px rgba(27, 42, 74, 0.08)',
                    padding: '8px 12px',
                  }}
                  labelFormatter={(label) => `Round ${Number(label).toLocaleString()}`}
                  formatter={(value, _name, entry) => {
                    const key = (entry as { dataKey?: string })?.dataKey;
                    const meta = FORECASTER_META.find((m) => m.key === key);
                    return [Number(value).toFixed(3), meta?.name ?? String(key ?? '')];
                  }}
                />
                {FORECASTER_META.map((meta, idx) => (
                  <Line
                    key={meta.key}
                    type="monotone"
                    dataKey={meta.key}
                    name={meta.name}
                    stroke={meta.colour}
                    strokeOpacity={getLineOpacity(selected, idx)}
                    strokeWidth={getLineStrokeWidth(selected, idx)}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Inset: electricity result as a small side card ── */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          marginTop: 12,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            flex: 2,
            background: 'rgba(46, 139, 139, 0.06)',
            border: `1.5px solid ${PALETTE.teal}`,
            borderRadius: 10,
            padding: '14px 20px',
          }}
        >
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: PALETTE.teal,
              fontFamily: TYPOGRAPHY.fontFamily,
            }}
          >
            Wind — skill tracks realised loss
          </div>
          <div
            style={{
              fontSize: '1.05rem',
              color: PALETTE.charcoal,
              fontFamily: TYPOGRAPHY.fontFamily,
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            Steady-state ranking: XGBoost (σ≈0.81) → ARIMA ≈ Naive (0.79) → MLP → Ensemble → EWMA → Theta. XGBoost wins on per-agent CRPS; Naive stays competitive because wind is highly autocorrelated.
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: 'rgba(232, 93, 74, 0.06)',
            border: `1.5px solid ${PALETTE.coral}`,
            borderRadius: 10,
            padding: '14px 20px',
          }}
        >
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: PALETTE.coral,
              fontFamily: TYPOGRAPHY.fontFamily,
            }}
          >
            Electricity — near-tie
          </div>
          <div
            style={{
              fontSize: '1.05rem',
              color: PALETTE.charcoal,
              fontFamily: TYPOGRAPHY.fontFamily,
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            Forecasters are similar in quality, so there is less heterogeneity for skill to exploit.
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
