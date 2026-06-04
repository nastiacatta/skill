import { motion, useReducedMotion } from 'framer-motion';
import type { RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import { AGENT_PALETTE, fmt } from './shared';

interface MechanismChainProps {
  trace: RoundTrace;
  selectedAgent: number | null;
  onSelectAgent: (i: number | null) => void;
}

interface ChainNode {
  key: string;
  label: string;
  sym: string;
  getValue: (trace: RoundTrace, agent: number) => number;
  getAggregate: (trace: RoundTrace) => number;
  color: string;
  bgColor: string;
}

const CHAIN_NODES: ChainNode[] = [
  {
    key: 'deposit', label: 'Deposit', sym: 'bᵢ',
    getValue: (t, i) => t.deposits[i],
    getAggregate: (t) => t.deposits.reduce((a, b) => a + b, 0),
    color: '#0ea5e9', bgColor: '#f0f9ff',
  },
  {
    key: 'influence', label: 'Wager', sym: 'mᵢ',
    getValue: (t, i) => t.effectiveWager[i],
    getAggregate: (t) => t.effectiveWager.reduce((a, b) => a + b, 0),
    color: '#6366f1', bgColor: '#eef2ff',
  },
  {
    key: 'aggregate', label: 'Aggregate', sym: 'r̂',
    getValue: () => 0,
    getAggregate: (t) => t.r_hat,
    color: '#0d9488', bgColor: '#f0fdfa',
  },
  {
    key: 'score', label: 'Score', sym: 'sᵢ',
    getValue: (t, i) => t.scores[i],
    getAggregate: (t) => t.scores.reduce((a, b) => a + b, 0) / Math.max(1, t.participated.filter(Boolean).length),
    color: '#f59e0b', bgColor: '#fffbeb',
  },
  {
    key: 'payoff', label: 'Payoff', sym: 'Πᵢ',
    getValue: (t, i) => t.profit[i],
    getAggregate: (t) => t.profit.reduce((a, b) => a + b, 0),
    color: '#10b981', bgColor: '#ecfdf5',
  },
  {
    key: 'skill', label: 'Skill update', sym: 'σᵢ′',
    getValue: (t, i) => t.sigma_new[i],
    getAggregate: (t) => t.sigma_new.reduce((a, b) => a + b, 0) / t.sigma_new.length,
    color: '#8b5cf6', bgColor: '#f5f3ff',
  },
  {
    key: 'wealth', label: 'Wealth', sym: 'Wᵢ′',
    getValue: (t, i) => t.wealth_after[i],
    getAggregate: (t) => t.wealth_after.reduce((a, b) => a + b, 0),
    color: '#ec4899', bgColor: '#fdf2f8',
  },
];

export default function MechanismChain({ trace, selectedAgent, onSelectAgent }: MechanismChainProps) {
  const N = trace.participated.length;
  const agentIdx = selectedAgent;
  // framer-motion ignores prefers-reduced-motion unless told; settle instantly.
  const reduce = useReducedMotion();

  return (
    <div className="space-y-4">
      {/* The chain scrolls sideways when it overflows; expose it as a labelled,
          focusable region so keyboard users can scroll it. */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-2"
        tabIndex={0}
        role="group"
        aria-label="Mechanism value chain"
      >
        {CHAIN_NODES.map((node, idx) => (
          <div key={node.key} className="contents">
            {idx > 0 && (
              <div className="shrink-0 flex items-center" style={{ color: 'var(--ink-faint)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduce ? { duration: 0 } : { delay: idx * 0.04 }}
              className="shrink-0 text-center"
              style={{
                minWidth: 118,
                padding: '12px 14px',
                border: `1px solid ${node.color}30`,
                borderTop: `3px solid ${node.color}`,
                background: node.bgColor,
                borderRadius: 4,
              }}
            >
              {/* Text uses ink tokens for legible contrast; the concept colour
                  is carried by the coloured top border and tint background. */}
              <div
                className="uppercase"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--ink-soft)',
                }}
              >
                {node.label}
              </div>
              <div
                className="font-mono tabular-nums"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {agentIdx != null && node.key !== 'aggregate'
                  ? fmt(node.getValue(trace, agentIdx), node.key === 'payoff' ? 2 : 3)
                  : fmt(node.getAggregate(trace), node.key === 'aggregate' ? 4 : 2)
                }
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: 'var(--ink-soft)',
                  marginTop: 2,
                }}
              >
                {node.sym}
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onSelectAgent(null)}
          className="transition-colors"
          style={{
            fontSize: 12,
            fontWeight: agentIdx == null ? 600 : 500,
            padding: '4px 12px',
            borderRadius: 999,
            background: agentIdx == null ? 'var(--navy)' : 'var(--cream)',
            color:      agentIdx == null ? '#fff' : 'var(--ink-soft)',
            border: '1px solid',
            borderColor: agentIdx == null ? 'var(--navy)' : 'var(--border)',
          }}
        >
          All agents
        </button>
        {Array.from({ length: N }, (_, i) => {
          const color = AGENT_PALETTE[i % AGENT_PALETTE.length];
          const active = agentIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectAgent(active ? null : i)}
              className="transition-all flex items-center gap-1.5"
              style={{
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                padding: '4px 12px',
                borderRadius: 999,
                background: active ? color : 'var(--cream)',
                color:      active ? '#fff' : 'var(--ink-soft)',
                border: '1px solid',
                borderColor: active ? color : 'var(--border)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#fff' : color }} />
              F{i + 1}
              {!trace.participated[i] && (
                <span style={{ fontSize: 12, opacity: 0.65 }}>(out)</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
