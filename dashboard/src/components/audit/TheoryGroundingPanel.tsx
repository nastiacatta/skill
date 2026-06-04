/**
 * TheoryGroundingPanel — Literature summary, theory-vs-practice table,
 * and highlighted theoretical predictions for the audit page.
 */

import { LITERATURE_REFS, THEORY_VS_PRACTICE } from '@/lib/audit/auditContent';
import type { LiteratureRef } from '@/lib/audit/auditTypes';
import { Card, SectionHeading, Tag } from '@/components/platform/ui';

// ── Category display config ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<LiteratureRef['category'], string> = {
  mechanism_design: 'Mechanism Design',
  linear_pool: 'Linear Pool Limitations',
  online_learning: 'Online Learning',
  alternative_aggregation: 'Alternative Aggregation',
  model_improvement: 'Model Improvement',
  collusion: 'Collusion & Incentives',
};

const CATEGORY_ORDER: LiteratureRef['category'][] = [
  'mechanism_design',
  'linear_pool',
  'online_learning',
  'alternative_aggregation',
  'model_improvement',
  'collusion',
];

// ════════════════════════════════════════════════════════════════════════════

export default function TheoryGroundingPanel() {
  // Group references by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    refs: LITERATURE_REFS.filter((r) => r.category === cat),
  })).filter((g) => g.refs.length > 0);

  return (
    <div className="space-y-10">
      {/* ── Highlighted predictions ──────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Key theoretical predictions" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HighlightCard
            title="Linear-Pool Miscalibration"
            source="Ranjan &amp; Gneiting (2010)"
            prediction="Any nontrivial weighted average of calibrated forecasts is uncalibrated."
            observation="Tail quantiles (0.1, 0.9) show coverage gaps of 3–5 percentage points."
            colour="amber"
          />
          <HighlightCard
            title="Multiplicative-Weights Regret Bound"
            source="Cesa-Bianchi &amp; Lugosi (2006)"
            prediction="MWU achieves O(√(T log N)) regret, which fixed-rate EWMA need not."
            observation="Mean CRPS (0.03788) sits 74% above oracle (0.02176) across 17,344 rounds."
            colour="blue"
          />
        </div>
      </section>

      {/* ── Literature summary by category ───────────────────────── */}
      <section className="space-y-6">
        <SectionHeading level={3} title="Literature summary" />
        {grouped.map((group) => (
          <div key={group.category}>
            <h3 className="text-base font-semibold text-slate-700 mb-3">
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.refs.map((ref) => (
                <ReferenceCard key={ref.id} ref_={ref} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Theory vs Practice table ─────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Theory vs practice" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider w-1/3">
                  Theoretical prediction
                </th>
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider w-1/3">
                  Empirical observation
                </th>
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider w-1/6">
                  Source
                </th>
                <th className="text-center py-2 text-[13px] font-semibold text-slate-500 uppercase tracking-wider w-1/6">
                  Supported?
                </th>
              </tr>
            </thead>
            <tbody>
              {THEORY_VS_PRACTICE.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-3 pr-4 text-slate-700 align-top">
                    {row.theoreticalPrediction}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 align-top">
                    {row.empiricalObservation}
                  </td>
                  <td className="py-3 pr-4 text-slate-500 align-top text-[13px]">
                    {row.source}
                  </td>
                  <td className="py-3 text-center align-top">
                    <Tag tone={row.supported ? 'good' : 'bad'} size="sm">
                      {row.supported ? '✓' : '✗'}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HighlightCard({
  title,
  source,
  prediction,
  observation,
  colour,
}: {
  title: string;
  source: string;
  prediction: string;
  observation: string;
  colour: 'amber' | 'blue';
}) {
  const bg = colour === 'amber' ? 'var(--amber-tint)' : 'var(--navy-tint)';
  const border = colour === 'amber' ? 'border-amber-300' : 'border-blue-300';

  return (
    <Card
      padding="default"
      className={`space-y-2 ${border}`}
      style={{ background: bg }}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <Tag tone={colour === 'amber' ? 'caution' : 'info'} size="sm">
          {source}
        </Tag>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-800">Theory: </span>
          {prediction}
        </p>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">Observed: </span>
          {observation}
        </p>
      </div>
    </Card>
  );
}

function ReferenceCard({ ref_ }: { ref_: LiteratureRef }) {
  return (
    <Card padding="default" className="space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="text-sm font-semibold text-slate-800">
          {ref_.authors}
        </span>
        <span className="text-sm text-slate-400 mt-0.5">&ndash;</span>
        <span className="text-sm text-slate-600 italic flex-1">
          {ref_.title}
        </span>
      </div>
      <p className="text-sm text-slate-700">
        <span className="font-medium">Key finding: </span>
        {ref_.keyFinding}
      </p>
      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-600">Dashboard connection: </span>
        {ref_.empiricalConnection}
      </p>
    </Card>
  );
}
