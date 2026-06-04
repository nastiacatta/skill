export interface ProvenanceBadgeProps {
  /** Data source type controlling the badge colour. */
  type: 'real' | 'synthetic' | 'demo';
  /** Full provenance label including context. */
  label: string;
}

/** Academic palette per provenance type. */
const CONFIG: Record<
  ProvenanceBadgeProps['type'],
  { bg: string; fg: string; border: string; dot: string }
> = {
  real:      { bg: 'var(--teal-tint)',  fg: 'var(--teal-deep)',  border: 'rgba(15, 118, 110, 0.25)', dot: 'var(--teal)' },
  synthetic: { bg: 'var(--amber-tint)', fg: '#78350f',           border: 'rgba(180, 83, 9, 0.25)',   dot: 'var(--amber)' },
  demo:      { bg: 'var(--card)',       fg: 'var(--ink-soft)',   border: 'var(--border)',             dot: 'var(--ink-faint)' },
};

/**
 * Academic provenance pill — small, warm, with a status dot.
 */
export default function ProvenanceBadge({ type, label }: ProvenanceBadgeProps) {
  const c = CONFIG[type];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5"
      style={{
        fontSize: 11,
        lineHeight: '16px',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: 999,
        fontWeight: 500,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: c.dot }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
