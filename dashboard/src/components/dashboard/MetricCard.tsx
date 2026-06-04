import { motion, useReducedMotion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
}

/**
 * Academic metric card — small eyebrow label, large tabular number in navy
 * when accented, warm border and paper card background.
 */
export default function MetricCard({ label, value, subtitle, accent }: MetricCardProps) {
  // Honour prefers-reduced-motion: framer-motion does not do this on its own,
  // so render the final state with no positional entrance when reduced.
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.2 }}
      className="min-w-0 transition-colors"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '14px 16px',
      }}
    >
      <p
        className="uppercase tracking-wider truncate"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'var(--ink-soft)',
        }}
      >
        {label}
      </p>
      <p
        className="mt-1 tabular-nums font-serif"
        style={{
          fontSize: 26,
          lineHeight: 1.15,
          fontWeight: 600,
          color: accent ? 'var(--navy)' : 'var(--ink)',
        }}
      >
        {value}
      </p>
      {subtitle && (
        <p
          className="truncate"
          style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
