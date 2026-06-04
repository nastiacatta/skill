/**
 * Thesis-companion content: the single static source that ties every dashboard
 * view to the draft section it supports, in the draft's own vocabulary, and the
 * compact chapter-to-view index on the research home.
 *
 * SOURCE OF TRUTH. Section and chapter numbers are the reader-facing numbers
 * from the compiled table of contents (`writing/thesis_draft.toc`): Results is
 * Chapter 4, Conclusion is Chapter 5, Post-hoc calibration is section 4.3 and
 * Robustness is section 4.4. Where an earlier plan disagreed with the compiled
 * draft, the draft wins (binding constraint). Section titles below are copied
 * verbatim from the compiled headings.
 *
 * Every claim id (C1, C8, ...) resolves to an existing entry in the provenance
 * registry (`@/lib/provenance/claims`); the gate test asserts that. Claims that
 * the registry does not carry (the budget-balance and channel-isolation claims,
 * which are live-simulator or draft-only and not on a card face here) are named
 * in the prose, not shown as a chip. Claim chips link to the dev-only
 * provenance panel and never render as a visitor link.
 *
 * Terminology follows the guided tour (`@/lib/platform/guidedTour`) and the
 * draft-match contract so the tour, the companion lines, and the index never
 * disagree. British spelling, no em-dashes, no semicolons.
 */

export interface CompanionRef {
  /** Section / chapter label as the reader sees it, e.g. "§4.2" or "Ch 1 & Ch 5". */
  section: string;
  /** Verbatim draft heading text for that section. */
  title: string;
  /** Optional figure or table reference, e.g. "Fig. F28". */
  fig?: string;
  /** Optional claim ids (C-ids in the provenance registry) this view rests on. */
  claims?: string[];
  /** Optional one-line note for cross-references or scope. */
  note?: string;
}

/**
 * Per-route companion lines, keyed by a stable view key (not the raw route, so
 * tab-level variants can carry their own ref). The draft section a view
 * supports, with the verbatim heading and any claim ids.
 */
export const COMPANION_REFS = {
  'platform': {
    section: '§1.1–1.2',
    title: 'Motivation and The problem',
  },
  'platform/forecast': {
    section: '§2.1',
    title: 'Round structure',
  },
  'platform/market': {
    section: '§2.1.3',
    title: 'Step 3: aggregation',
    note: 'Synthetic illustration. The real-data aggregate is in §4.2.',
  },
  'platform/stress': {
    section: '§4.4',
    title: 'Robustness',
    claims: ['C21', 'C22', 'C23'],
  },
  'platform/account': {
    section: '§4.1',
    title: 'Synthetic validation',
    note: 'Illustrative synthetic panel.',
  },
  'platform/leaderboard': {
    section: '§4.2.1.1',
    title: 'Per-forecaster skill and weight ordering',
    claims: ['C8'],
  },
  'platform/operator': {
    section: '§4.2',
    title: 'Real-data validation',
    claims: ['C1', 'C10'],
  },
  'research': {
    section: 'Ch 1 & Ch 5',
    title: 'Introduction and Conclusion',
  },
  'evidence': {
    section: '§4.2',
    title: 'Real-data validation',
    claims: ['C1', 'C6', 'C10'],
  },
  'evidence/ablation': {
    section: '§4.1.4',
    title: 'Isolating the deposit and skill channels',
    fig: 'Fig. F28',
  },
  'evidence/cams': {
    section: '§4.2',
    title: 'Replication on a mixture-of-experts panel',
  },
  'evidence/calibration': {
    section: '§4.3',
    title: 'Post-hoc calibration',
    claims: ['C13', 'C14', 'C15', 'C16'],
  },
  'robustness': {
    section: '§4.4',
    title: 'Robustness',
    claims: ['C21', 'C22', 'C23'],
  },
  'explainer': {
    section: '§2.1',
    title: 'Round structure',
  },
  'explainer/invariants': {
    section: '§2.2',
    title: 'Properties',
  },
  'audit/theory': {
    section: '§2.2 & App. B',
    title: 'Properties, and Properties and formal statements',
  },
  'notes': {
    section: '§4.1.4 & §4.2',
    title: 'Isolating the deposit and skill channels, and Real-data validation',
    claims: ['C1', 'C10'],
  },
  'appendix/experiments': {
    section: 'App. I',
    title: 'Supplementary real-data results',
  },
  'appendix/figures': {
    section: 'App. K',
    title: 'Supplementary diagrams',
  },
  'appendix/diagnostics': {
    section: '§4.2.1.3',
    title: 'Audit-slice replication',
    claims: ['C13', 'C14', 'C15', 'C16'],
  },
} as const satisfies Record<string, CompanionRef>;

export type CompanionKey = keyof typeof COMPANION_REFS;

/**
 * The compact "Where each chapter lives" index on the research home: every
 * draft chapter or section mapped to the dashboard view that holds its
 * evidence. Static, no fetch. Chapter 3 and section 4.3 get a findable home
 * here without a new page.
 */
export interface SectionIndexRow {
  /** Draft chapter or section, reader-facing, with its verbatim heading. */
  chapter: string;
  /** Primary view(s) that hold the evidence. */
  views: { label: string; to: string }[];
}

export const SECTION_INDEX: SectionIndexRow[] = [
  {
    chapter: 'Ch 1 Introduction',
    views: [{ label: 'Research home', to: '/research' }],
  },
  {
    chapter: 'Ch 2 Mechanism design (§2.1 round, §2.2 properties)',
    views: [{ label: 'Explainer', to: '/explainer' }],
  },
  {
    chapter: 'Ch 3 Implementation and evaluation',
    views: [
      { label: 'Notes', to: '/notes' },
      { label: 'Audit-slice diagnostics', to: '/appendix/diagnostics' },
    ],
  },
  {
    chapter: '§4.1 Synthetic validation',
    views: [
      { label: 'Evidence (Scientific Analysis)', to: '/evidence' },
      { label: 'Market', to: '/platform/market' },
    ],
  },
  {
    chapter: '§4.2 Real-data validation',
    views: [{ label: 'Evidence', to: '/evidence' }],
  },
  {
    chapter: '§4.2.1.3 Audit-slice replication',
    views: [{ label: 'Audit-slice diagnostics', to: '/appendix/diagnostics' }],
  },
  {
    chapter: '§4.3 Post-hoc calibration',
    views: [
      { label: 'Evidence (Calibration)', to: '/evidence' },
      { label: 'Audit-slice diagnostics', to: '/appendix/diagnostics' },
    ],
  },
  {
    chapter: '§4.4 Robustness',
    views: [
      { label: 'Robustness', to: '/robustness' },
      { label: 'Stress tests', to: '/platform/stress' },
    ],
  },
  {
    chapter: 'Ch 5 Conclusion',
    views: [{ label: 'Principal findings', to: '/research' }],
  },
  {
    chapter: 'Appendices (A–N)',
    views: [{ label: 'Simulation lab', to: '/appendix' }],
  },
];
