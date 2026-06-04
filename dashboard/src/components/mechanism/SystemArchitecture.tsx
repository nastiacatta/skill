import { useState, useCallback, useMemo } from 'react';
import { SEM } from '@/lib/tokens';
import MathBlock from '@/components/dashboard/MathBlock';

/* ─── Node & layer data structures ──────────────────────────────── */

interface ArchNode {
  id: string;
  label: string;
  sym: string;
  color: string;
  bg: string;
  desc: string;
  formula?: string;
}

interface Layer {
  id: string;
  step: number;
  title: string;
  subtitle: string;
  accent: string;
  nodes: ArchNode[];
}

const LAYERS: Layer[] = [
  {
    id: 'inputs', step: 1,
    title: 'Exogenous inputs & state',
    subtitle: 'What the mechanism receives at the start of round t',
    accent: '#64748b',
    nodes: [
      { id: 'x', label: 'Private info', sym: 'xᵢ,ₜ', color: '#64748b', bg: '#f1f5f9', desc: 'Each agent\u2019s private signal about the upcoming outcome' },
      { id: 'W', label: 'Wealth', sym: 'Wᵢ,ₜ', color: SEM.wealth.main, bg: SEM.wealth.light, desc: 'Current wealth carried from the previous round' },
      { id: 'sigma', label: 'Skill state', sym: 'σᵢ,ₜ', color: SEM.skill.main, bg: SEM.skill.light, desc: 'Online skill estimate from past performance, ∈ [σ_min, 1]', formula: 'L_{i,t} = (1-\\rho)L_{i,t-1} + \\rho\\,\\ell_{i,t},\\quad \\sigma_{i,t} = \\sigma_{\\min} + (1-\\sigma_{\\min})e^{-\\gamma L_{i,t-1}}' },
      { id: 'theta', label: 'Parameters', sym: 'θ', color: '#475569', bg: '#f8fafc', desc: 'Mechanism parameters: λ, γ, σ_min, scoring rule, aggregation rule' },
      { id: 'task', label: 'Task / env', sym: 'env', color: '#94a3b8', bg: '#f8fafc', desc: 'The forecasting task; produces realised outcome yₜ later' },
    ],
  },
  {
    id: 'behaviour', step: 2,
    title: 'Agent decisions',
    subtitle: 'Choices made by each agent, not primitive inputs to the system',
    accent: SEM.deposit.main,
    nodes: [
      { id: 'r', label: 'Report', sym: 'rᵢ,ₜ', color: SEM.outcome.main, bg: SEM.outcome.light, desc: 'Agent i\u2019s probabilistic forecast for the outcome' },
      { id: 'b', label: 'Deposit', sym: 'bᵢ,ₜ', color: SEM.deposit.main, bg: SEM.deposit.light, desc: 'Wealth agent i puts up as a deposit this round' },
      { id: 'part', label: 'Participation', sym: '∈ / ∉', color: '#64748b', bg: '#f1f5f9', desc: 'Whether agent i participates in this round' },
    ],
  },
  {
    id: 'core', step: 3,
    title: 'Mechanism core',
    subtitle: 'Transforms, aggregation, and forecast publication, before outcome',
    accent: SEM.wager.main,
    nodes: [
      { id: 'elig', label: 'Eligibility', sym: '✓ / ✗', color: '#64748b', bg: '#f1f5f9', desc: 'Validate participation, check deposits, exclude absent agents' },
      { id: 'm', label: 'Eff. wager', sym: 'mᵢ,ₜ', color: SEM.wager.main, bg: SEM.wager.light, desc: 'Deposit rescaled by the past-only skill gate g(σ)', formula: 'm_{i,t} = b_{i,t}\\bigl(\\lambda + (1-\\lambda)\\,\\sigma_{i,t}^{\\eta}\\bigr)' },
      { id: 'cap', label: 'Cap / normalise', sym: 'w̃ᵢ', color: '#6366f1', bg: '#eef2ff', desc: 'Cap individual weights so no single agent dominates aggregation' },
      { id: 'agg', label: 'Aggregate', sym: 'r̂ₜ', color: SEM.aggregate.main, bg: SEM.aggregate.light, desc: 'Wager-weighted average of the reports (a quasi-arithmetic quantile pool, not a linear pool of CDFs)', formula: '\\hat{r}_t = \\sum_i w_i\\,r_{i,t}' },
    ],
  },
  {
    id: 'settle', step: 4,
    title: 'Outcome & settlement',
    subtitle: 'After outcome yₜ is realised: scoring, then payoffs',
    accent: SEM.payoff.main,
    nodes: [
      { id: 'y', label: 'Outcome', sym: 'yₜ', color: SEM.outcome.main, bg: SEM.outcome.light, desc: 'The realised outcome, observed after forecasts are locked in' },
      { id: 's', label: 'Score', sym: 'sᵢ,ₜ', color: SEM.score.main, bg: SEM.score.light, desc: 'How close agent i\u2019s report was to yₜ', formula: 's_{i,t} = S(r_{i,t},\\, y_t)' },
      { id: 'Pi', label: 'Settlement', sym: 'Πᵢ,ₜ', color: SEM.payoff.main, bg: SEM.payoff.light, desc: 'Competitive settlement from effective wagers and relative score', formula: '\\Pi^{\\mathrm{skill}}_{i,t} = m_{i,t}\\bigl(1 + s_{i,t} - \\bar{s}_t\\bigr),\\quad \\bar{s}_t = \\frac{\\sum_j m_{j,t}s_{j,t}}{\\sum_j m_{j,t}}' },
    ],
  },
  {
    id: 'outputs', step: 5,
    title: 'Outputs & state update',
    subtitle: 'What the mechanism produces, fed back into the next round',
    accent: SEM.wealth.main,
    nodes: [
      { id: 'rhat_out', label: 'Forecast', sym: 'r̂ₜ', color: SEM.aggregate.main, bg: SEM.aggregate.light, desc: 'Published aggregate forecast for consumers' },
      { id: 'm_out', label: 'Weights', sym: 'mᵢ', color: SEM.wager.main, bg: SEM.wager.light, desc: 'Effective weights used in aggregation' },
      { id: 'Pi_out', label: 'Payoffs', sym: 'Πᵢ', color: SEM.payoff.main, bg: SEM.payoff.light, desc: 'Individual payoffs after settlement' },
      { id: 'refund', label: 'Refund', sym: 'bᵢ − mᵢ', color: '#475569', bg: '#f8fafc', desc: 'Immediate refund of the deposit portion that does not count as effective wager', formula: '\\mathrm{refund}_{i,t} = b_{i,t} - m_{i,t}' },
      { id: 'W_next', label: 'Wealth\u2032', sym: 'Wᵢ,ₜ₊₁', color: SEM.wealth.main, bg: SEM.wealth.light, desc: 'Updated wealth for the next round', formula: 'W_{i,t+1} = W_{i,t} + \\pi_{i,t},\\quad \\pi_{i,t} = \\Pi^{\\mathrm{skill}}_{i,t} - m_{i,t}' },
      { id: 'sigma_next', label: 'Skill\u2032', sym: 'σᵢ,ₜ₊₁', color: SEM.skill.main, bg: SEM.skill.light, desc: 'Updated online skill estimate for the next round' },
      { id: 'diag', label: 'Diagnostics', sym: 'Neff, HHI', color: '#94a3b8', bg: '#f8fafc', desc: 'Concentration metrics, calibration, effective sample size' },
    ],
  },
];

const EDGES: [string, string][] = [
  ['x', 'r'], ['x', 'b'], ['W', 'b'], ['sigma', 'r'], ['sigma', 'b'], ['sigma', 'm'],
  ['theta', 'm'], ['theta', 'cap'], ['theta', 'agg'], ['task', 'y'],
  ['r', 'elig'], ['b', 'elig'], ['part', 'elig'],
  ['elig', 'm'], ['m', 'cap'], ['cap', 'agg'],
  ['agg', 'rhat_out'], ['cap', 'm_out'],
  ['y', 's'], ['elig', 's'], ['cap', 'Pi'], ['s', 'Pi'],
  ['Pi', 'Pi_out'], ['Pi_out', 'W_next'], ['m', 'refund'], ['refund', 'W_next'], ['s', 'sigma_next'],
  ['Pi', 'diag'], ['s', 'diag'],
  ['W_next', 'W'], ['sigma_next', 'sigma'],
];

const TIMELINE_STEPS: ArchNode[] = [
  { id: 't1', label: 'Observe', sym: 'xᵢ, Wᵢ, σᵢ', color: '#64748b', bg: '#f1f5f9', desc: 'Agents see private info, current wealth and skill state' },
  { id: 't2', label: 'Submit', sym: 'rᵢ, bᵢ', color: SEM.deposit.main, bg: SEM.deposit.light, desc: 'Submit a quantile report rᵢ and a deposit bᵢ' },
  { id: 't3', label: 'Skill gate', sym: 'mᵢ', color: SEM.wager.main, bg: SEM.wager.light, desc: 'Deposit is rescaled by the past-only skill gate g(σ) into the effective wager mᵢ = bᵢ·g(σᵢ)' },
  { id: 't4', label: 'Aggregate', sym: 'r̂ₜ', color: SEM.aggregate.main, bg: SEM.aggregate.light, desc: 'Reports combined by wager-weighted averaging into the aggregate r̂ₜ' },
  { id: 't5', label: 'Outcome', sym: 'yₜ', color: SEM.outcome.main, bg: SEM.outcome.light, desc: 'Realised outcome is observed (exogenous)' },
  { id: 't6', label: 'Score', sym: 'sᵢ', color: SEM.score.main, bg: SEM.score.light, desc: 'Each report scored against the realised outcome via the pinball CRPS' },
  { id: 't7', label: 'Settle', sym: 'Πᵢ', color: SEM.payoff.main, bg: SEM.payoff.light, desc: 'Settle payoff πᵢ = mᵢ(1 + sᵢ − s̄); profit = πᵢ − mᵢ' },
  { id: 't8', label: 'Update', sym: 'W\u2032, σ\u2032', color: SEM.wealth.main, bg: SEM.wealth.light, desc: 'EWMA loss updates and σ is recomputed; the only cross-round signal, feeding the next round gate' },
];

/* ─── Helpers ──────────────────────────────────────────────────── */

function buildAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const [from, to] of EDGES) {
    if (!adj.has(from)) adj.set(from, new Set());
    if (!adj.has(to)) adj.set(to, new Set());
    adj.get(from)!.add(to);
    adj.get(to)!.add(from);
  }
  return adj;
}

/* ─── Sub-components ──────────────────────────────────────────── */

function LayerBand({ layer, hovered, selected, onHover, onSelect, adjacency }: {
  layer: Layer;
  hovered: string | null;
  selected: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  adjacency: Map<string, Set<string>>;
}) {
  const highlightedSet = useMemo(() => {
    if (!hovered) return null;
    const set = new Set<string>();
    set.add(hovered);
    adjacency.get(hovered)?.forEach(n => set.add(n));
    return set;
  }, [hovered, adjacency]);

  return (
    <div className="relative">
      {/* Layer header */}
      <div className="flex items-baseline gap-2.5 mb-3">
        <span
          className="flex items-center justify-center shrink-0 font-mono"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: layer.accent,
            color: '#fff',
            fontSize: 13, fontWeight: 700,
          }}
        >
          {layer.step}
        </span>
        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
          <span
            className="font-serif"
            style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}
          >
            {layer.title}
          </span>
          <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
            {layer.subtitle}
          </span>
        </div>
      </div>

      {/* Nodes */}
      <div className="flex flex-wrap gap-2 pl-7">
        {layer.nodes.map(node => {
          const dimmed = highlightedSet && !highlightedSet.has(node.id);
          const isSelected = selected === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => onHover(node.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(node.id)}
              className="relative text-center cursor-pointer transition-all duration-150"
              style={{
                minWidth: 88,
                padding: '8px 12px',
                borderRadius: 4,
                border: `1.5px solid ${isSelected ? node.color : node.color + '40'}`,
                background: node.bg,
                opacity: dimmed ? 0.25 : 1,
                transform: isSelected ? 'scale(1.04)' : undefined,
                boxShadow: isSelected ? `0 0 0 3px ${node.color}25` : undefined,
              }}
            >
              {/* Text uses ink tokens for AA contrast on the tint; the concept
                  colour is carried by the node border. */}
              <div
                className="uppercase"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--ink-soft)',
                }}
              >
                {node.label}
              </div>
              <div
                className="font-mono mt-0.5"
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
              >
                {node.sym}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DownArrows({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center py-1 pl-7">
      <svg width="80" height="16" viewBox="0 0 80 16">
        <path d="M20 2v8M20 10l-3-3M20 10l3-3 M40 2v8M40 10l-3-3M40 10l3-3 M60 2v8M60 10l-3-3M60 10l3-3"
          stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4" />
      </svg>
    </div>
  );
}

function NodeDetail({ node, onClose }: { node: ArchNode; onClose: () => void }) {
  return (
    <div
      className="relative animate-in fade-in duration-200 mt-3"
      style={{
        border: `1px solid ${node.color}40`,
        borderLeft: `3px solid ${node.color}`,
        background: node.bg,
        borderRadius: 4,
        padding: 16,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 transition-colors flex items-center justify-center"
        style={{
          width: 22, height: 22,
          borderRadius: '50%',
          color: 'var(--ink-faint)',
          fontSize: 13,
        }}
      >
        ✕
      </button>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: node.color }} />
        <span
          className="font-serif"
          style={{ fontSize: 14, fontWeight: 600, color: node.color }}
        >
          {node.label}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 13, color: 'var(--ink-muted)' }}
        >
          {node.sym}
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
        {node.desc}
      </p>
      {node.formula && (
        <div className="mt-3">
          <MathBlock latex={node.formula} />
        </div>
      )}
    </div>
  );
}

function FeedbackLoop() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        background: 'var(--cream)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 4,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
        <path d="M16 28A12 12 0 1 1 28 16" stroke={SEM.wealth.main} strokeWidth="2" fill="none" strokeDasharray="4 3" />
        <path d="M24 16l4 0 0-4" stroke={SEM.wealth.main} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div>
        <div
          className="font-serif"
          style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}
        >
          Feedback to next round
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 2 }}>
          <span className="font-mono" style={{ color: SEM.wealth.main }}>Wᵢ,ₜ₊₁</span> and{' '}
          <span className="font-mono" style={{ color: SEM.skill.main }}>σᵢ,ₜ₊₁</span>{' '}
          become the starting state at <span className="font-mono">t+1</span>, closing the loop.
        </div>
      </div>
    </div>
  );
}

/* ─── Timeline view ───────────────────────────────────────────── */

function TimelineView({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const selectedNode = TIMELINE_STEPS.find(n => n.id === selected) ?? null;

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>
        Chronology within a single round. Click any step for details.
      </p>

      {/* Desktop: horizontal scroll */}
      <div className="overflow-x-auto pb-3 -mx-1">
        <div className="flex items-stretch gap-0 min-w-max px-1">
          {TIMELINE_STEPS.map((step, i) => {
            const isSelected = selected === step.id;
            return (
              <div key={step.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="relative text-center transition-all duration-150 cursor-pointer"
                  style={{
                    minWidth: 96,
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: `1.5px solid ${isSelected ? step.color : step.color + '35'}`,
                    background: step.bg,
                    transform: isSelected ? 'scale(1.04)' : undefined,
                    boxShadow: isSelected ? `0 0 0 3px ${step.color}25` : undefined,
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <div
                    className="font-mono"
                    style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-faint)', marginBottom: 2 }}
                  >
                    {i + 1}
                  </div>
                  {/* Text uses ink tokens for AA contrast on the tint; the
                      concept colour is carried by the step border. */}
                  <div
                    className="uppercase"
                    style={{
                      fontSize: 14, fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'var(--ink-soft)',
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    className="font-mono mt-1.5"
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
                  >
                    {step.sym}
                  </div>
                </button>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div className="flex items-center px-1 shrink-0">
                    <svg width="24" height="16" viewBox="0 0 24 16">
                      <path d="M2 8h16M14 4l4 4-4 4" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}

          {/* Feedback arrow wrapping back */}
          <div className="flex items-center pl-2 shrink-0">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5"
              style={{
                background: 'var(--cream)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 4,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20">
                <path d="M10 16A6 6 0 1 1 16 10" stroke={SEM.wealth.main} strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
                <path d="M14 10l2 0 0-2" stroke={SEM.wealth.main} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span
                className="uppercase"
                style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
              >
                t+1
              </span>
            </div>
          </div>
        </div>
      </div>

      {selectedNode && (
        <NodeDetail node={selectedNode} onClose={() => onSelect('')} />
      )}

      <p
        className="mt-3 italic"
        style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}
      >
        The outcome node sits <em>before</em> scoring and payoff: the mechanism cannot score before it observes yₜ.
      </p>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────── */

type DiagramView = 'architecture' | 'timeline';

export default function SystemArchitecture() {
  const [view, setView] = useState<DiagramView>('architecture');
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const adjacency = useMemo(() => buildAdjacency(), []);

  const allNodes = useMemo(() => {
    const map = new Map<string, ArchNode>();
    for (const layer of LAYERS) {
      for (const node of layer.nodes) {
        map.set(node.id, node);
      }
    }
    return map;
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelected(prev => prev === id ? null : id);
  }, []);

  const selectedArchNode = selected ? allNodes.get(selected) ?? null : null;

  return (
    <div className="space-y-4">
      {/* View tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex p-1"
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          {([
            { id: 'architecture' as DiagramView, label: 'System architecture' },
            { id: 'timeline' as DiagramView, label: 'Within-round timing' },
          ]).map(tab => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setView(tab.id); setSelected(null); setHovered(null); }}
                className="px-3 py-1.5 transition-colors"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  borderRadius: 4,
                  background: active ? 'var(--card)' : 'transparent',
                  color:      active ? 'var(--ink)' : 'var(--ink-soft)',
                  boxShadow:  active ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
          {view === 'architecture'
            ? 'Hover to trace connections. Click a node for its definition.'
            : 'Click a step for details.'}
        </span>
      </div>

      {/* Architecture view */}
      {view === 'architecture' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
          }}
          className="space-y-1"
        >
          {LAYERS.map((layer, i) => (
            <div key={layer.id}>
              <LayerBand
                layer={layer}
                hovered={hovered}
                selected={selected}
                onHover={setHovered}
                onSelect={handleSelect}
                adjacency={adjacency}
              />
              {i < LAYERS.length - 1 && (
                <DownArrows accent={LAYERS[i + 1].accent} />
              )}
            </div>
          ))}

          <div className="mt-4">
            <FeedbackLoop />
          </div>

          {selectedArchNode && (
            <NodeDetail node={selectedArchNode} onClose={() => setSelected(null)} />
          )}

          <p
            className="pt-3"
            style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}
          >
            <strong style={{ color: 'var(--ink)' }}>Reading guide.</strong> mᵢ is <em>not</em> an agent input; it is produced by the mechanism from bᵢ and σᵢ.
            The outcome yₜ arrives <em>after</em> aggregation, so scoring and settlement depend on it.
            Updated wealth and skill feed back into the next round, making the system dynamic, not one-shot.
          </p>
        </div>
      )}

      {/* Timeline view */}
      {view === 'timeline' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <TimelineView selected={selected} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
}
