import { VERDICT_COLOURS } from '@/lib/palette';

/**
 * Variant controlling the visual style of the MetricDisplay card.
 *
 * - "default": white background, slate border, no accent.
 * - "verdict-good": emerald left border + emerald-tinted background.
 * - "verdict-neutral": amber left border + amber-tinted background.
 * - "verdict-bad": red left border + red-tinted background.
 */
export type MetricVariant = 'default' | 'verdict-good' | 'verdict-neutral' | 'verdict-bad';

export interface MetricDisplayProps {
  /** KPI label displayed above the value. */
  label: string;
  /** Formatted value string (e.g. "−34%", "0.83"). */
  value: string;
  /** Visual variant; defaults to "default". */
  variant?: MetricVariant;
  /** Optional description rendered below the value. */
  detail?: string;
  /** Optional secondary text rendered below the label. */
  subtitle?: string;
}

/** Map variant keys to palette entries for verdict variants. */
const VARIANT_KEY: Record<Exclude<MetricVariant, 'default'>, keyof typeof VERDICT_COLOURS> = {
  'verdict-good': 'good',
  'verdict-neutral': 'neutral',
  'verdict-bad': 'bad',
};

/**
 * Unified KPI card component.
 *
 * Replaces MetricCard, inline Metric function (BehaviourPage), and the
 * numeric display portion of VerdictCard. Uses Tailwind CSS classes with
 * verdict colours sourced from `@/lib/palette` for consistency.
 */
export default function MetricDisplay({
  label,
  value,
  variant = 'default',
  detail,
  subtitle,
}: MetricDisplayProps) {
  const isVerdict = variant !== 'default';

  // Resolve inline styles for verdict variants from the shared palette.
  const verdictStyle: React.CSSProperties | undefined = isVerdict
    ? {
        borderLeftWidth: '3px',
        borderLeftStyle: 'solid',
        borderLeftColor: VERDICT_COLOURS[VARIANT_KEY[variant as Exclude<MetricVariant, 'default'>]].border,
        backgroundColor: VERDICT_COLOURS[VARIANT_KEY[variant as Exclude<MetricVariant, 'default'>]].bg,
      }
    : undefined;

  return (
    <div
      className={[
        'rounded-xl border px-4 py-3 min-w-0',
        isVerdict ? 'border-transparent' : 'border-slate-200 bg-white',
      ].join(' ')}
      style={verdictStyle}
    >
      {/* Label — 11px minimum, uppercase, bold, tracking-wider, slate-400 */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
        {label}
      </p>

      {/* Subtitle — optional, 11px, slate-400, below label */}
      {subtitle && (
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
      )}

      {/* Value — 16px minimum (text-base), bold, monospace, slate-800 */}
      <p className="text-base font-bold font-mono text-slate-800 mt-1 tabular-nums">
        {value}
      </p>

      {/* Detail — optional, 12px, normal weight, slate-500, below value */}
      {detail && (
        <p className="text-xs font-normal text-slate-500 mt-0.5">{detail}</p>
      )}
    </div>
  );
}
