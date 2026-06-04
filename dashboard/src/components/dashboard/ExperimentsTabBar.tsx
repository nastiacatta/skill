import { Link } from 'react-router-dom';
import clsx from 'clsx';

const TABS = [
  { id: 'pipeline', label: 'Time-step pipeline', to: '/pipeline' },
  { id: 'experiments', label: 'Experiments', to: '/experiments' },
] as const;

interface ExperimentsTabBarProps {
  /** Current tab (for highlighting) */
  activeTab: 'pipeline' | 'experiments';
  className?: string;
}

export default function ExperimentsTabBar({ activeTab, className }: ExperimentsTabBarProps) {
  return (
    <div
      className={clsx('inline-flex p-1', className)}
      role="tablist"
      aria-label="Main sections"
      style={{
        background: 'var(--cream)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      {TABS.map((t) => {
        const active = activeTab === t.id;
        return (
          <Link
            key={t.id}
            to={t.to}
            role="tab"
            aria-selected={active}
            className="px-4 py-1.5 transition-colors"
            style={{
              fontSize: 13.5,
              fontWeight: active ? 600 : 500,
              borderRadius: 4,
              background: active ? 'var(--card)' : 'transparent',
              color:      active ? 'var(--ink)' : 'var(--ink-soft)',
              boxShadow:  active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
