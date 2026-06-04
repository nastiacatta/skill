import { useMemo } from 'react';

interface CoverageItem {
  name: string;
  status: 'experiment' | 'taxonomy-only' | 'not-covered';
  experimentTab?: string;
}

interface CoverageFamily {
  family: string;
  items: CoverageItem[];
}

interface CoverageAuditProps {
  families: CoverageFamily[];
  onNavigate?: (tab: string) => void;
}

const DOT_COLORS: Record<string, string> = {
  experiment:      'var(--teal)',
  'taxonomy-only': 'var(--amber)',
  'not-covered':   'var(--ink-faint)',
};

const BAR_COLORS: Record<string, string> = {
  experiment:      'var(--teal)',
  'taxonomy-only': 'var(--amber)',
  'not-covered':   'var(--border-strong)',
};

/**
 * Academic coverage audit — warm card, coloured bar per family, pill chips.
 */
export default function CoverageAudit({ families, onNavigate }: CoverageAuditProps) {
  const stats = useMemo(() => {
    const all = families.flatMap((f) => f.items);
    const experiment = all.filter((i) => i.status === 'experiment').length;
    const taxonomyOnly = all.filter((i) => i.status === 'taxonomy-only').length;
    const notCovered = all.filter((i) => i.status === 'not-covered').length;
    const total = all.length;
    const pct = total > 0 ? ((experiment / total) * 100).toFixed(1) : '0.0';
    return { experiment, taxonomyOnly, notCovered, total, pct };
  }, [families]);

  return (
    <div
      className="p-5"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h3
        className="font-serif tracking-tight mb-3 flex items-center gap-2.5"
        style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
      >
        <span
          aria-hidden="true"
          className="inline-block"
          style={{ width: 3, height: 16, background: 'var(--navy)', borderRadius: 2 }}
        />
        Coverage audit
      </h3>

      {/* Aggregate stats */}
      <div className="flex flex-wrap items-center gap-4 mb-5" style={{ fontSize: 14.5 }}>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{stats.total} items</span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--teal)' }} />
          {stats.experiment} experiment
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--amber)' }} />
          {stats.taxonomyOnly} taxonomy-only
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--ink-faint)' }} />
          {stats.notCovered} not covered
        </span>
        <span
          className="ml-auto font-mono tabular-nums"
          style={{ color: 'var(--ink)', fontWeight: 600 }}
        >
          {stats.pct}% coverage
        </span>
      </div>

      {/* Per-family sections */}
      <div className="space-y-3.5">
        {families.map((fam) => {
          const exp = fam.items.filter((i) => i.status === 'experiment').length;
          const tax = fam.items.filter((i) => i.status === 'taxonomy-only').length;
          const nc = fam.items.filter((i) => i.status === 'not-covered').length;
          const total = fam.items.length;

          return (
            <div key={fam.family}>
              <p
                className="capitalize mb-1.5 font-serif"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
              >
                {fam.family}
              </p>

              {/* Coverage bar */}
              <div
                className="flex w-full overflow-hidden"
                style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}
              >
                {exp > 0 && <div style={{ width: `${(exp / total) * 100}%`, background: BAR_COLORS.experiment }} />}
                {tax > 0 && <div style={{ width: `${(tax / total) * 100}%`, background: BAR_COLORS['taxonomy-only'] }} />}
                {nc > 0 && <div style={{ width: `${(nc / total) * 100}%`, background: BAR_COLORS['not-covered'] }} />}
              </div>

              {/* Item list */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fam.items.map((item) => {
                  const clickable = item.status === 'experiment' && item.experimentTab;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onNavigate?.(item.experimentTab!)}
                      className="inline-flex items-center gap-1.5"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--ink-muted)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: clickable ? 'pointer' : 'default',
                        opacity: clickable ? 1 : 0.7,
                      }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: DOT_COLORS[item.status] }}
                      />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
