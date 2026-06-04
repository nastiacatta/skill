import type { InsightCardProps } from '../../../lib/comparison/types';

const COLOR_MAP: Record<InsightCardProps['color'], { border: string; bg: string; text: string; dot: string }> = {
  green:  { border: 'border-l-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber:  { border: 'border-l-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
  red:    { border: 'border-l-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'     },
  blue:   { border: 'border-l-indigo-500',  bg: 'bg-indigo-50',   text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
};

/**
 * Insight card for comparison slides.
 *
 * Icons are rendered as coloured glyph bullets (not emojis). The `icon` prop
 * is accepted for API compatibility but is no longer displayed as emoji; the
 * coloured bar + dot communicate severity/category.
 */
export default function InsightCard({ color, title, description }: InsightCardProps) {
  const c = COLOR_MAP[color];

  return (
    <div
      className={`rounded-xl border border-slate-200 ${c.border} border-l-4 ${c.bg} p-5 flex gap-3 items-start`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${c.dot}`}
      />
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
