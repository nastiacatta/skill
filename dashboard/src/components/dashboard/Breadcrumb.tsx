import { Link, useLocation } from 'react-router-dom';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Overview',
  mechanism: 'Mechanism',
  results: 'Results',
  robustness: 'Robustness',
  appendix: 'Appendix',
  experiments: 'Experiments',
};

interface BreadcrumbProps {
  activeTab?: string;
}

/**
 * Academic breadcrumb — thin rule between labels, warm low-contrast palette.
 */
export default function Breadcrumb({ activeTab }: BreadcrumbProps) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: { label: string; to: string }[] = [
    { label: 'Overview', to: '/' },
  ];

  let path = '';
  for (const seg of segments) {
    path += `/${seg}`;
    const label = ROUTE_LABELS[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, to: path });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 mb-5"
      style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1 && !activeTab;
        return (
          <span key={crumb.to} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" style={{ color: 'var(--ink-faint)', opacity: 0.6 }}>
                /
              </span>
            )}
            {isLast ? (
              <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>{crumb.label}</span>
            ) : (
              <Link
                to={crumb.to}
                className="transition-colors"
                style={{ color: 'var(--ink-soft)' }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink)'; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-soft)'; }}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
      {activeTab && (
        <span className="flex items-center gap-2">
          <span aria-hidden="true" style={{ opacity: 0.6 }}>/</span>
          <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>{activeTab}</span>
        </span>
      )}
    </nav>
  );
}
