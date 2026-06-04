/* ── Hex → rgba helper ─────────────────────────────────────────────── */

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

/* ── Types ─────────────────────────────────────────────────────────── */

interface ForecasterSelectorProps {
  /** Forecaster names in display order (sorted by skill) */
  forecasters: Array<{ name: string; index: number; color: string }>;
  /** Currently selected forecaster index (into the original dataset, not display order) */
  selectedIndex: number;
  /** Callback when user selects a forecaster */
  onSelect: (index: number) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

/**
 * Horizontal row of pill buttons for selecting a single forecaster.
 *
 * Active pill: filled background at 15% opacity of the forecaster colour,
 * coloured text, coloured border (1px solid).
 * Inactive pill: slate border, slate text, hover:bg-slate-50.
 *
 * Mirrors the MethodFilter visual pattern but uses single-select.
 */
export default function ForecasterSelector({
  forecasters,
  selectedIndex,
  onSelect,
}: ForecasterSelectorProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Forecaster selector"
    >
      {forecasters.map((f) => {
        const active = f.index === selectedIndex;

        return (
          <button
            key={f.index}
            type="button"
            onClick={() => onSelect(f.index)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
              !active ? 'hover:bg-slate-50' : ''
            }`}
            style={{
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 500,
              border: active
                ? `1px solid ${f.color}`
                : '1px solid #e2e8f0', // border-slate-200
              backgroundColor: active
                ? hexToRgba(f.color, 0.15)
                : 'transparent',
              color: active ? f.color : '#64748b', // text-slate-500
            }}
            aria-pressed={active}
          >
            {/* Colour dot */}
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: active ? f.color : '#94a3b8',
              }}
            />
            {f.name}
          </button>
        );
      })}
    </div>
  );
}
