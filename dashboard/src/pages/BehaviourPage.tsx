import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TRANSITION } from '@/components/platform/designTokens';
import { TAXONOMY_ITEMS } from '@/lib/behaviour/taxonomyData';
import { useBehaviourSimulations } from '@/hooks/useBehaviourSimulations';
import { FigureProvider } from '@/contexts/FigureContext';
import { EquationProvider } from '@/contexts/EquationContext';
import TabBar from '@/components/dashboard/TabBar';
import ShareLinkButton from '@/components/dashboard/ShareLinkButton';
import { useQueryParamState } from '@/hooks/useQueryParamState';

// ── Tab components ─────────────────────────────────────────────────────────
import OverviewTab from '@/components/behaviour/tabs/OverviewTab';
import ParticipationTab from '@/components/behaviour/tabs/ParticipationTab';
import InformationTab from '@/components/behaviour/tabs/InformationTab';
import AdversarialTab from '@/components/behaviour/tabs/AdversarialTab';
import ReportingTab from '@/components/behaviour/tabs/ReportingTab';
import SensitivityTab from '@/components/behaviour/tabs/SensitivityTab';
import StakingTab from '@/components/behaviour/tabs/StakingTab';
import ObjectivesTab from '@/components/behaviour/tabs/ObjectivesTab';
import IdentityTab from '@/components/behaviour/tabs/IdentityTab';
import LearningTab from '@/components/behaviour/tabs/LearningTab';
import OperationalTab from '@/components/behaviour/tabs/OperationalTab';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { Card } from '@/components/platform/ui';

// ── 11-tab structure ───────────────────────────────────────────────────────

type Tab =
  | 'Overview' | 'Participation' | 'Information' | 'Reporting' | 'Staking'
  | 'Objectives' | 'Identity' | 'Learning' | 'Adversarial' | 'Operational' | 'Sensitivity';

/** Core tabs with experiment-backed content. */
const CORE_TABS: Tab[] = ['Overview', 'Participation', 'Information', 'Reporting', 'Adversarial', 'Sensitivity'];
/** Extended tabs — in-browser simulations. */
const EXTENDED_TABS: Tab[] = ['Staking', 'Objectives', 'Identity', 'Learning', 'Operational'];

/** Display order: core tabs first, then extended. */
const DISPLAY_TABS: Tab[] = [...CORE_TABS, ...EXTENDED_TABS];

/** Deep-link param validator: an unknown ?tab= falls back to the default. */
const isBehaviourTab = (v: string): v is Tab =>
  (DISPLAY_TABS as string[]).includes(v);

/** Tabs that have experiment-backed content (not just taxonomy placeholders). */
const EXPERIMENT_TABS = new Set<string>(
  TAXONOMY_ITEMS
    .filter((item) => item.status === 'experiment' && item.tab)
    .map((item) => item.tab!),
);
// Overview and Sensitivity are always experiment-backed
EXPERIMENT_TABS.add('Overview');
EXPERIMENT_TABS.add('Sensitivity');

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function BehaviourPage() {
  const [tab, setTab] = useQueryParamState<Tab>('tab', 'Overview', isBehaviourTab);
  const reduceMotion = useReducedMotion();

  // ── All simulations via custom hook ────────────────────────────────────
  const sims = useBehaviourSimulations();
  const { baseline, pipelines, summary: behaviourSummary, familyImpact, sweep } = sims;

  return (
    <FigureProvider>
    <EquationProvider>
    <PageShell width="wide">
        <PageHeader
          hero
          eyebrow="Robustness"
          title="Robustness"
          companion={<ThesisRef viewKey="robustness" note="The §4.4 catalogue is the Adversarial tab. Other tabs are supplementary exploration (Appendix E and J)." />}
          subtitle="Eighteen behaviour presets run against a truthful baseline on identical seeds and draws, so reported deltas isolate the behaviour itself."
        />

        <Card
          padding="default"
          elevation="raised"
          className="text-[15px] leading-relaxed"
          style={{ marginTop: 8, color: 'var(--ink-soft)' }}
        >
          <p>
            Synthetic draws give the paired counterfactuals and identity labels real series cannot. The honest-forecaster result on real data sits under <em>Evidence</em>.
          </p>
        </Card>

        {/* ── Tab bar with experiment/taxonomy indicators ─────────────── */}
        {/* min-w-0 lets the TabBar's internal overflow-x-auto scroll the 11
            tabs rather than overflowing the page edge at 1280/1440. The
            progress label is kept short so it does not reserve fixed width
            that pushes tabs offscreen. */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <TabBar
              tabs={DISPLAY_TABS}
              activeTab={tab}
              onTabChange={(t) => setTab(t as Tab)}
              experimentTabs={EXPERIMENT_TABS}
              groupBreaks={[CORE_TABS.length]}
              progressLabel={`${DISPLAY_TABS.indexOf(tab) + 1} / ${DISPLAY_TABS.length}`}
            />
          </div>
          <ShareLinkButton />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }} transition={reduceMotion ? { duration: 0 } : TRANSITION.view}>
            {tab === 'Overview' && <OverviewTab summary={behaviourSummary} familyImpact={familyImpact} setTab={setTab} />}
            {tab === 'Participation' && <ParticipationTab bursty={pipelines.bursty} baseline={baseline} />}
            {tab === 'Information' && <InformationTab biased={pipelines.biased} miscalibrated={pipelines.miscalibrated} baseline={baseline} />}
            {tab === 'Adversarial' && <AdversarialTab manipulator={pipelines.manipulator} arbitrageur={pipelines.arbitrageur} sybil={pipelines.sybil} collusion={pipelines.collusion} repReset={pipelines.reputation_reset} evader={pipelines.evader} baseline={baseline} />}
            {tab === 'Reporting' && <ReportingTab riskAverse={pipelines.risk_averse} noisyReporter={pipelines.noisy_reporter} reputationGamer={pipelines.reputation_gamer} sandbagger={pipelines.sandbagger} baseline={baseline} />}
            {tab === 'Sensitivity' && <SensitivityTab data={sweep} />}
            {tab === 'Staking' && <StakingTab budgetConstrained={pipelines.budget_constrained} houseMoney={pipelines.house_money} kellySizer={pipelines.kelly_sizer} baseline={baseline} />}
            {tab === 'Objectives' && <ObjectivesTab riskAverse={pipelines.risk_averse} baseline={baseline} />}
            {tab === 'Identity' && <IdentityTab sybil={pipelines.sybil} collusion={pipelines.collusion} repReset={pipelines.reputation_reset} baseline={baseline} />}
            {tab === 'Learning' && <LearningTab />}
            {tab === 'Operational' && <OperationalTab latencyExploiter={pipelines.latency_exploiter} baseline={baseline} />}
          </motion.div>
        </AnimatePresence>
    </PageShell>
    </EquationProvider>
    </FigureProvider>
  );
}
