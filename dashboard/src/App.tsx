import { useEffect, lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider } from '@/lib/store';
import { ExplorerProvider } from '@/lib/explorerStore';
import TopBar from '@/components/dashboard/TopBar';
import Sidebar from '@/components/dashboard/Sidebar';
import SmallScreenNotice from '@/components/dashboard/SmallScreenNotice';
import StickyGlossary from '@/components/dashboard/StickyGlossary';
import BackToTop from '@/components/dashboard/BackToTop';
import KeyboardShortcuts from '@/components/dashboard/KeyboardShortcuts';
import { GuidedTourProvider, GuidedTourRail } from '@/components/platform/GuidedTour';
import { RouteFallback, RouteErrorBoundary } from '@/components/dashboard/ShellStates';
import { useNavShortcuts } from '@/hooks/useNavShortcuts';

/*
 * Every routed page is code-split. The research pages pull heavy chart and
 * maths libraries (recharts, katex), so lazy-loading them keeps the eager
 * main bundle small and shares those vendor chunks across pages. The
 * platform showcase routes were already lazy; the research and
 * slides routes join them here so no route is both lazy and eager.
 */

// Platform showcase
const PlatformLandingPage = lazy(() => import('@/pages/platform/PlatformLandingPage'));
const ForecastFlowPage = lazy(() => import('@/pages/platform/ForecastFlowPage'));
const MarketPage = lazy(() => import('@/pages/platform/MarketPage'));
const StressPage = lazy(() => import('@/pages/platform/StressPage'));
const AccountPage = lazy(() => import('@/pages/platform/AccountPage'));
const LeaderboardPage = lazy(() => import('@/pages/platform/LeaderboardPage'));
const OperatorPage = lazy(() => import('@/pages/platform/OperatorPage'));

// Research / thesis support
const ResearchOverviewPage = lazy(() => import('@/pages/HomePage'));
const ResultsPage = lazy(() => import('@/pages/ResultsPage'));
const BehaviourPage = lazy(() => import('@/pages/BehaviourPage'));
const ExplainerPage = lazy(() => import('@/pages/MechanismPage'));
const AuditPage = lazy(() => import('@/pages/AuditPage'));
const NotesPage = lazy(() => import('@/pages/NotesPage'));
const LabPage = lazy(() => import('@/pages/LabPage'));
const ExperimentsPage = lazy(() => import('@/pages/experiments/ExperimentsPage'));
const AppendixFigures = lazy(() => import('@/pages/Appendix'));
const AppendixDiagnostics = lazy(() => import('@/pages/AppendixDiagnostics'));

// Printable companion summary: a lazy, registry-sourced one-page view.
const SummaryPage = lazy(() => import('@/pages/SummaryPage'));

// Standalone presentation (no shell)
const PresentationPage = lazy(() => import('@/pages/PresentationPage'));

// Developer / QA only: number-provenance diagnostics. Not in any nav; gated to
// dev/preview builds inside the component. Never part of the visitor flow.
const ProvenancePanel = lazy(() => import('@/pages/ProvenancePanel'));

/** Page title per canonical route; `"${label} · Skill × Stake"`. */
export const ROUTE_TITLES: Record<string, string> = {
  '/platform': 'Platform',
  '/platform/forecast': 'Submit a forecast',
  '/platform/market': 'Market',
  '/platform/stress': 'Attacks',
  '/platform/account': 'My account',
  '/platform/leaderboard': 'Leaderboard',
  '/platform/operator': 'Operator',
  '/research': 'Research',
  '/evidence': 'Evidence',
  '/robustness': 'Robustness',
  '/explainer': 'Explainer',
  '/audit': 'Audit',
  '/notes': 'Notes',
  '/appendix': 'Appendix · Lab',
  '/appendix/experiments': 'Appendix · Experiments',
  '/appendix/figures': 'Appendix · Figures',
  '/appendix/diagnostics': 'Appendix · Diagnostics',
  '/summary': 'Summary',
  '/dev/provenance': 'Dev · Provenance',
  '/slides': 'Slides',
};

export function titleForPath(pathname: string): string {
  return ROUTE_TITLES[pathname] ?? 'Page';
}

/**
 * Scroll to top on route change, set the document title, and run a single,
 * consistent fade transition for every routed view in both zones.
 */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    document.title = `${titleForPath(location.pathname)} · Skill × Stake`;
  }, [location.pathname]);
  // A calm, consistent entrance per view (fade + a small upward slide). The
  // `key` remounts the node on each route change so the CSS keyframe re-runs;
  // the keyframe matches the shared motion tokens (opacity 0 to 1, 8px upward
  // slide, 240ms, ease-out). The reduce-motion guard in index.css collapses it
  // to an instant swap, exactly as the previous framer-motion version did.
  return (
    <div
      key={location.pathname}
      className="page-transition-view flex-1 overflow-hidden flex flex-col"
    >
      {children}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ExplorerProvider>
        <HashRouter>
          <Routes>
            {/* Full-screen presentation: standalone, no shell, in neither zone */}
            <Route
              path="/slides"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PresentationPage />
                </Suspense>
              }
            />
            <Route path="/presentation" element={<Navigate to="/slides" replace />} />

            {/* Everything else lives inside the unified two-zone shell */}
            <Route path="*" element={<AppShell />} />
          </Routes>
        </HashRouter>
      </ExplorerProvider>
    </StoreProvider>
  );
}

/** The unified shell: sticky top bar, zone-aware rail, scrolling content. */
function AppShell() {
  const location = useLocation();
  useNavShortcuts();

  return (
    <GuidedTourProvider>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--paper)' }}>
        <SmallScreenNotice />
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden flex flex-col" style={{ background: 'var(--paper)' }}>
            <PageTransition>
              <RouteErrorBoundary resetKey={location.pathname}>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* ── Platform showcase (the front door) ── */}
                    <Route path="/platform" element={<PlatformLandingPage />} />
                    <Route path="/platform/forecast" element={<ForecastFlowPage />} />
                    <Route path="/platform/market" element={<MarketPage />} />
                    <Route path="/platform/stress" element={<StressPage />} />
                    <Route path="/platform/account" element={<AccountPage />} />
                    <Route path="/platform/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/platform/operator" element={<OperatorPage />} />

                    {/* ── Thesis support ── */}
                    <Route path="/research" element={<ResearchOverviewPage />} />
                    <Route path="/evidence" element={<ResultsPage />} />
                    <Route path="/robustness" element={<BehaviourPage />} />
                    <Route path="/explainer" element={<ExplainerPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/notes" element={<NotesPage />} />
                    <Route path="/appendix" element={<LabPage />} />
                    <Route path="/appendix/experiments" element={<ExperimentsPage />} />
                    <Route path="/appendix/figures" element={<AppendixFigures />} />
                    <Route path="/appendix/diagnostics" element={<AppendixDiagnostics />} />

                    {/* ── Printable companion summary (utility view, not a zone) ── */}
                    <Route path="/summary" element={<SummaryPage />} />

                    {/* ── Developer / QA diagnostics (hidden, no nav link) ── */}
                    <Route path="/dev/provenance" element={<ProvenancePanel />} />

                    {/* ── Legacy redirects (no inbound link may 404) ── */}
                    <Route path="/" element={<Navigate to="/platform" replace />} />
                    <Route path="/story" element={<Navigate to="/platform" replace />} />
                    <Route path="/platform/me" element={<Navigate to="/platform/account" replace />} />
                    <Route path="/about" element={<Navigate to="/research" replace />} />
                    <Route path="/overview" element={<Navigate to="/research" replace />} />
                    <Route path="/results" element={<Navigate to="/evidence" replace />} />
                    <Route path="/comparison" element={<Navigate to="/evidence" replace />} />
                    <Route path="/comparisons" element={<Navigate to="/evidence" replace />} />
                    <Route path="/behaviour" element={<Navigate to="/robustness" replace />} />
                    <Route path="/validation" element={<Navigate to="/robustness" replace />} />
                    <Route path="/explorer" element={<Navigate to="/explainer" replace />} />
                    <Route path="/mechanism" element={<Navigate to="/explainer" replace />} />
                    <Route path="/walkthrough" element={<Navigate to="/explainer" replace />} />
                    <Route path="/pipeline" element={<Navigate to="/explainer" replace />} />
                    <Route path="/mechanism-explorer" element={<Navigate to="/explainer" replace />} />
                    <Route path="/lab" element={<Navigate to="/appendix" replace />} />
                    <Route path="/experiments" element={<Navigate to="/appendix/experiments" replace />} />

                    {/* Unknown routes fall back to the front door */}
                    <Route path="*" element={<Navigate to="/platform" replace />} />
                  </Routes>
                </Suspense>
              </RouteErrorBoundary>
            </PageTransition>
          </main>
        </div>
      </div>
      <StickyGlossary />
      <BackToTop />
      <KeyboardShortcuts />
      <GuidedTourRail />
    </GuidedTourProvider>
  );
}
