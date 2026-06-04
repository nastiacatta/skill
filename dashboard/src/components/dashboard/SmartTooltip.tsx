import { TOOLTIP_STYLE, fmt } from '@/components/lab/shared';

export interface SmartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}

/**
 * Warm academic tooltip — serif label, tabular values, no heavy shadows.
 */
export function SmartTooltip({ active, payload, label, formatter }: SmartTooltipProps) {
  if (!active || !payload?.length) return null;

  const filtered = payload.filter(p => p.value != null);
  if (!filtered.length) return null;

  const format = formatter ?? ((v: number) => fmt(v, 4));

  return (
    <div style={TOOLTIP_STYLE}>
      {label != null && (
        <div
          className="font-serif"
          style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}
        >
          {typeof label === 'number' ? `Round ${label}` : label}
        </div>
      )}
      {filtered.map(p => (
        <div
          key={p.dataKey}
          className="flex items-center gap-2"
          style={{ fontSize: 12, marginTop: 2 }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color }}
          />
          <span style={{ color: 'var(--ink-soft)' }}>{p.name}</span>
          <span
            className="font-mono tabular-nums ml-auto"
            style={{ color: 'var(--ink)', fontWeight: 500 }}
          >
            {format(p.value, p.name)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default SmartTooltip;
