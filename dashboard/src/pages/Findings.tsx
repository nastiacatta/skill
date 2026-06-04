import { Link } from 'react-router-dom';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';

export default function Findings() {
  return (
    <PageShell width="narrow">
      <PageHeader
        hero
        title="Findings"
        subtitle="Main results, round-by-round behaviour, strategic effects, and robustness checks."
      />
      <p
        className="font-serif"
        style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--ink-muted)' }}
      >
        All experiment results and diagnostics live under <strong>Experiments</strong>. Choose an
        experiment in the top bar to see the main result, what happens in one round, what changes
        under strategic behaviour, and robustness checks.
      </p>
      <Link
        to="/experiments"
        className="inline-flex items-center px-4 py-2 text-sm font-medium"
        style={{
          background: 'var(--navy)',
          color: '#fff',
          borderRadius: 6,
        }}
      >
        Open Experiments →
      </Link>
    </PageShell>
  );
}
