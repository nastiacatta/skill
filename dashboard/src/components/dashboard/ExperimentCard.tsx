import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { ExperimentMeta } from '@/lib/types';

type BlockConfig = { bg: string; fg: string; border: string; dot: string };

const BLOCK_COLORS: Record<string, BlockConfig> = {
  core:        { bg: 'var(--teal-tint)',  fg: 'var(--teal-deep)',  border: 'rgba(15,118,110,0.25)', dot: 'var(--teal)' },
  behaviour:   { bg: 'var(--plum-tint)',  fg: 'var(--plum)',       border: 'rgba(91,33,182,0.22)',  dot: 'var(--plum)' },
  experiments: { bg: 'var(--navy-tint)',  fg: 'var(--navy)',       border: 'rgba(29,52,97,0.22)',   dot: 'var(--navy)' },
};

const FALLBACK: BlockConfig = {
  bg: 'var(--cream)', fg: 'var(--ink-soft)', border: 'var(--border)', dot: 'var(--ink-faint)',
};

/**
 * Experiment card with academic styling — warm paper surface, subtle border,
 * block pill in palette accent.
 */
export default function ExperimentCard({ experiment }: { experiment: ExperimentMeta }) {
  const navigate = useNavigate();
  const pill = BLOCK_COLORS[experiment.block] ?? FALLBACK;

  const metrics: { label: string; value: string }[] = [];
  if (experiment.nAgents != null) metrics.push({ label: 'Agents', value: String(experiment.nAgents) });
  if (experiment.rounds != null) metrics.push({ label: 'Rounds', value: String(experiment.rounds) });
  if (experiment.dgp) metrics.push({ label: 'DGP', value: experiment.dgp });

  return (
    <motion.button
      layoutId={`exp-card-${experiment.name}`}
      type="button"
      onClick={() => navigate('/appendix/experiments')}
      whileHover={{ y: -1 }}
      className="group relative text-left w-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        padding: 16,
        borderRadius: 4,
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
      onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5"
          style={{
            fontSize: 11, fontWeight: 600, borderRadius: 999,
            background: pill.bg, color: pill.fg, border: `1px solid ${pill.border}`,
          }}
        >
          <span className="inline-block w-1 h-1 rounded-full" style={{ background: pill.dot }} />
          {experiment.block}
        </span>
      </div>
      <h3
        className="font-serif truncate"
        style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}
      >
        {experiment.displayName || experiment.name}
      </h3>
      <p
        className="line-clamp-2 mt-1"
        style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}
      >
        {experiment.description || 'No description available.'}
      </p>
      {metrics.length > 0 && (
        <div
          className="flex gap-4 mt-3 pt-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {metrics.slice(0, 3).map((m) => (
            <div key={m.label} style={{ fontSize: 11 }}>
              <span
                className="uppercase tracking-wider"
                style={{ color: 'var(--ink-faint)', fontWeight: 600 }}
              >
                {m.label}
              </span>{' '}
              <span
                className="font-mono tabular-nums ml-0.5"
                style={{ color: 'var(--ink-muted)', fontWeight: 500 }}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}
      <span
        aria-hidden="true"
        className="absolute top-3 right-3 transition-all duration-150 group-hover:translate-x-0.5"
        style={{ color: 'var(--ink-faint)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </motion.button>
  );
}
