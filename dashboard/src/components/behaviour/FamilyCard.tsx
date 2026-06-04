import { motion, useReducedMotion } from 'framer-motion';

interface FamilyCardProps {
  family: string;
  description: string;
  items: Array<{ name: string; status: 'experiment' | 'taxonomy-only' | 'not-covered' }>;
  color: string;
  onClick?: () => void;
}

const STATUS_DOT: Record<string, string> = {
  experiment:      'var(--teal)',
  'taxonomy-only': 'var(--amber)',
  'not-covered':   'var(--ink-faint)',
};

/**
 * Behaviour family card — warm academic tint, serif title, outline status pills.
 * The `color` prop still drives Tailwind bg/text classes, so family grouping
 * stays visually distinct while the surface is cleaner.
 */
export default function FamilyCard({
  family,
  description,
  items,
  color,
  onClick,
}: FamilyCardProps) {
  // framer-motion does not respect prefers-reduced-motion on its own; render
  // the settled state with no positional entrance when the user asks for it.
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.2 }}
      className={`p-4 text-left transition-shadow ${color}`}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h4
        className="font-serif capitalize tracking-tight"
        style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
      >
        {family}
      </h4>
      <p
        className="mt-1"
        style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)' }}
      >
        {description}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {items.map((item) => (
          <span
            key={item.name}
            className="inline-flex items-center gap-1.5"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--ink-muted)',
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: STATUS_DOT[item.status] }}
            />
            {item.name}
          </span>
        ))}
      </div>
    </motion.button>
  );
}
