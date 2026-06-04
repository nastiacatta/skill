import { useAuditData } from '@/hooks/useAuditData';
import { useQueryParamState } from '@/hooks/useQueryParamState';
import ShareLinkButton from '@/components/dashboard/ShareLinkButton';
import TheoryGroundingPanel from '@/components/audit/TheoryGroundingPanel';
import ModelAuditPanel from '@/components/audit/ModelAuditPanel';
import SkillAllocationPanel from '@/components/audit/SkillAllocationPanel';
import WagerAllocationPanel from '@/components/audit/WagerAllocationPanel';
import AggregationAccuracyPanel from '@/components/audit/AggregationAccuracyPanel';
import ImprovementPanel from '@/components/audit/ImprovementPanel';
import TabBar from '@/components/dashboard/TabBar';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';
import ThesisRef from '@/components/dashboard/ThesisRef';

// ── Tab configuration ──────────────────────────────────────────────────────

const AUDIT_TABS = [
  'Theory',
  'Models',
  'Skill',
  'Wagers',
  'Aggregation',
  'Improvements',
] as const;
type AuditTab = (typeof AUDIT_TABS)[number];

/** Deep-link param validator: an unknown ?tab= falls back to the default. */
const isAuditTab = (v: string): v is AuditTab =>
  (AUDIT_TABS as readonly string[]).includes(v);

// ════════════════════════════════════════════════════════════════════════════
// AUDIT PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function AuditPage() {
  const [tab, setTab] = useQueryParamState<AuditTab>('tab', 'Theory', isAuditTab);
  const data = useAuditData();

  return (
    <PageShell width="wide">
        <PageHeader
          hero
          eyebrow="Performance review"
          title="Performance audit"
          subtitle="The mechanism measured against theory and baselines."
          companion={tab === 'Theory' ? <ThesisRef viewKey="audit/theory" /> : undefined}
        />

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <TabBar
              tabs={AUDIT_TABS}
              activeTab={tab}
              onTabChange={(t) => setTab(t as AuditTab)}
              progressLabel={`Tab ${AUDIT_TABS.indexOf(tab) + 1} of ${AUDIT_TABS.length}: ${tab}`}
            />
          </div>
          <ShareLinkButton />
        </div>

        {/* ── Loading state ────────────────────────────────────────── */}
        {data.loading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="flex items-center gap-3"
              style={{ fontSize: 14, color: 'var(--ink-soft)' }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full rounded-full animate-ping"
                  style={{ background: 'var(--navy)', opacity: 0.6 }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: 'var(--navy)' }}
                />
              </span>
              Loading audit data&hellip;
            </div>
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────────────── */}
        {data.errors.length > 0 && (
          <div
            className="px-4 py-3"
            style={{
              background: 'var(--amber-tint)',
              border: '1px solid rgba(180, 83, 9, 0.25)',
              borderRadius: 6,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: '#78350f' }}>
              Some data files could not be loaded:
            </p>
            <ul
              className="mt-1 list-disc list-inside"
              style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}
            >
              {data.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Tab content ──────────────────────────────────────────── */}
        {!data.loading && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            {tab === 'Theory' && <TheoryGroundingPanel />}
            {tab === 'Models' && <ModelAuditPanel />}
            {tab === 'Skill' && <SkillAllocationPanel />}
            {tab === 'Wagers' && <WagerAllocationPanel />}
            {tab === 'Aggregation' && <AggregationAccuracyPanel />}
            {tab === 'Improvements' && <ImprovementPanel />}
          </div>
        )}
    </PageShell>
  );
}
