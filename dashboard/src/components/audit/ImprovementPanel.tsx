/**
 * ImprovementPanel — Prioritised improvement recommendations organised
 * by category with sub-tabs, priority badges, and evidence citations.
 */

import { useState, useMemo } from 'react';
import { RECOMMENDATIONS } from '@/lib/audit/auditContent';
import type { Recommendation } from '@/lib/audit/auditTypes';
import { Card, SectionHeading, Tag } from '@/components/platform/ui';

const PRIORITY_TONE: Record<Recommendation['priority'], 'bad' | 'caution' | 'neutral'> = {
  high: 'bad',
  medium: 'caution',
  low: 'neutral',
};

// ── Category configuration ─────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'model' as const, label: 'Model' },
  { key: 'skill' as const, label: 'Skill' },
  { key: 'aggregation' as const, label: 'Aggregation' },
  { key: 'economic' as const, label: 'Economic' },
];

type Category = Recommendation['category'];

// ════════════════════════════════════════════════════════════════════════════

export default function ImprovementPanel() {
  const [activeCategory, setActiveCategory] = useState<Category>('model');

  const filteredRecs = useMemo(
    () =>
      RECOMMENDATIONS.filter((r) => r.category === activeCategory).sort(
        (a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        },
      ),
    [activeCategory],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      model: 0,
      skill: 0,
      aggregation: 0,
      economic: 0,
    };
    for (const rec of RECOMMENDATIONS) {
      counts[rec.category]++;
    }
    return counts;
  }, []);

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          level={3}
          title="Improvement recommendations"
          subtitle="Prioritised across four categories, with evidence and estimated CRPS impact."
        />
      </section>

      {/* ── Category sub-tabs ────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-slate-200">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeCategory === cat.key
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {cat.label}
            <span className="ml-1.5 text-[13px] text-slate-400">
              ({categoryCounts[cat.key]})
            </span>
          </button>
        ))}
      </div>

      {/* ── Recommendation cards ──────────────────────────────────── */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
        {filteredRecs.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">
            No recommendations in this category.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card padding="default" className="space-y-3">
      <div className="flex items-start gap-3">
        <Tag tone={PRIORITY_TONE[rec.priority]} size="sm" className="uppercase tracking-wider">
          {rec.priority}
        </Tag>
        <h3 className="text-base font-semibold text-slate-900 flex-1">
          {rec.title}
        </h3>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed">
        {rec.description}
      </p>

      {rec.evidence && (
        <div className="rounded border border-slate-100 px-3 py-2" style={{ background: 'var(--cream)' }}>
          <p className="text-[13px] text-slate-500">
            <span className="font-semibold text-slate-600">Evidence: </span>
            {rec.evidence}
          </p>
        </div>
      )}

      {rec.crpsEstimate && (
        <p className="text-[13px] text-indigo-600 font-medium">
          Estimated impact: {rec.crpsEstimate}
        </p>
      )}
    </Card>
  );
}
