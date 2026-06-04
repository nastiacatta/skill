import type { FC } from 'react';

/**
 * The single source of truth for the unified app shell's navigation.
 *
 * The product has two zones: the **Platform** (the interactive showcase,
 * "try it") and the **Research** (the thesis-support evidence, "read it").
 * The top bar swaps between them; each zone has its own rail of items. The
 * cross-link map carries a visitor from one zone to the matching view in the
 * other in a single click.
 *
 * Routes and pairings are defined in the platform design notes.
 * Copy uses the terminology established in the thesis draft.
 */

export type Zone = 'platform' | 'research';

export interface NavItem {
  /** Canonical route (hash path, no leading '#'). */
  to: string;
  /** Visible label. */
  label: string;
  /** Inline SVG icon (decorative; paired with the label). */
  icon: FC<{ className?: string; size?: number }>;
  /** Single-key shortcut within the active zone (1-9). */
  shortcut?: string;
  /** One-line purpose, surfaced as a tooltip / aside. */
  hint: string;
}

/* ------------------------------------------------------------------ */
/*  Icon set: inline SVG, 1.5px stroke, currentColor (design §7)       */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string; size?: number };
const svgProps = (size: number) => ({
  className: undefined as string | undefined,
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
});

export const PlayIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 8.5L15.5 12L10 15.5V8.5Z" fill="currentColor" />
  </svg>
);

export const PenIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M4 20L8 19L19 8C19.8 7.2 19.8 6 19 5.2L18.8 5C18 4.2 16.8 4.2 16 5L5 16L4 20Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M14.5 6.5L17.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const MarketIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M4 16L9 10L13 13L20 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 20H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 6H20V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PersonIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5.5 19C5.5 15.5 8.4 13.5 12 13.5C15.6 13.5 18.5 15.5 18.5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const TrophyIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M7 4H17V9C17 11.8 14.8 14 12 14C9.2 14 7 11.8 7 9V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M7 5.5H4.5V7C4.5 8.7 5.8 10 7.5 10M17 5.5H19.5V7C19.5 8.7 18.2 10 16.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 14V17M9 20H15M10 17H14V20H10V17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const OperatorIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 20H16M12 16.5V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 12L10 9L13 11.5L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CompassIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M15.5 8.5L13.5 13.5L8.5 15.5L10.5 10.5L15.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const ChartIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <rect x="3.5" y="13" width="4" height="6.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="10" y="8" width="4" height="11.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="16.5" y="4" width="4" height="15.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const ShieldIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M12 3L5 5.5V11C5 15.5 8 18.5 12 20C16 18.5 19 15.5 19 11V5.5L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 11.5L11.2 13.7L15 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StepsIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M4 19H8V15M10 15H14V11M16 11H20V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 19V12.5M4 19H4.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ClipboardIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <rect x="5" y="5" width="14" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 4H15V6.5H9V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8.5 11H15.5M8.5 14.5H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const BookIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M4 5.5H9C10.1 5.5 11 6.4 11 7.5V19C11 18.2 10.3 17.5 9.5 17.5H4V5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M20 5.5H15C13.9 5.5 13 6.4 13 7.5V19C13 18.2 13.7 17.5 14.5 17.5H20V5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const FlaskIcon: FC<IconProps> = ({ className, size = 22 }) => (
  <svg {...svgProps(size)} className={className} aria-hidden="true">
    <path d="M9.5 3.5V9L4.5 18C4 19 4.7 20 5.8 20H18.2C19.3 20 20 19 19.5 18L14.5 9V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8 3.5H16M7 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Zone nav rails                                                     */
/* ------------------------------------------------------------------ */

/** Platform showcase: the lens rail (try it). */
export const PLATFORM_NAV: NavItem[] = [
  { to: '/platform', label: 'Explainer', icon: PlayIcon, shortcut: '1', hint: 'One animated round of the mechanism' },
  { to: '/platform/forecast', label: 'Submit a forecast', icon: PenIcon, shortcut: '2', hint: 'Play a forecaster: author a fan, set a deposit, settle' },
  { to: '/platform/market', label: 'Market', icon: MarketIcon, shortcut: '3', hint: 'The living market: the wager-weighted aggregate forming' },
  { to: '/platform/stress', label: 'Attacks', icon: ShieldIcon, shortcut: '4', hint: 'Pick an attack, watch the same panel run with and without it' },
  { to: '/platform/account', label: 'My account', icon: PersonIcon, shortcut: '5', hint: 'Bankroll, skill trajectory, own calibration, rank' },
  { to: '/platform/leaderboard', label: 'Leaderboard', icon: TrophyIcon, shortcut: '6', hint: 'The panel ranked by skill, wealth and pool share' },
  { to: '/platform/operator', label: 'Operator', icon: OperatorIcon, shortcut: '7', hint: 'Post tasks, watch aggregate quality versus uniform' },
];

/** Thesis support: the chapter flow (read it). */
export const RESEARCH_NAV: NavItem[] = [
  { to: '/research', label: 'Overview', icon: CompassIcon, shortcut: '1', hint: 'The question, the mechanism map, and where the evidence sits' },
  { to: '/evidence', label: 'Evidence', icon: ChartIcon, shortcut: '2', hint: 'Headline results: wind, electricity, operational benchmark' },
  { to: '/robustness', label: 'Robustness', icon: ShieldIcon, shortcut: '3', hint: 'Adversary catalogue, ablations and sensitivity' },
  { to: '/explainer', label: 'Explainer', icon: StepsIcon, shortcut: '4', hint: 'The five within-round steps, walked through' },
  { to: '/audit', label: 'Audit', icon: ClipboardIcon, shortcut: '5', hint: 'Model, theory, skill, wager and aggregation audit' },
  { to: '/notes', label: 'Notes', icon: BookIcon, shortcut: '6', hint: 'Methodology notes, derivations, hyperparameters' },
  { to: '/appendix', label: 'Appendix', icon: FlaskIcon, shortcut: '7', hint: 'The lab hub: experiments, figures, diagnostics' },
];

export interface ZoneDef {
  /** The face label on the segmented control. */
  faceLabel: string;
  /** A short gloss under the face label. */
  faceHint: string;
  /** Where selecting the face lands the visitor. */
  home: string;
  /** The rail items for this zone. */
  items: NavItem[];
}

export const ZONES: Record<Zone, ZoneDef> = {
  platform: {
    faceLabel: 'Try the platform',
    faceHint: 'The interactive prediction market',
    home: '/platform',
    items: PLATFORM_NAV,
  },
  research: {
    faceLabel: 'Read the research',
    faceHint: "The project's evidence behind it",
    home: '/research',
    items: RESEARCH_NAV,
  },
};

export const ZONE_ORDER: Zone[] = ['platform', 'research'];

/**
 * Which zone a route belongs to. Everything under `/platform` is the
 * platform; every other shell route is research. `/slides` is standalone
 * (no zone) and is handled outside the shell.
 */
export function zoneForPath(pathname: string): Zone {
  return pathname === '/platform' || pathname.startsWith('/platform/')
    ? 'platform'
    : 'research';
}

/* ------------------------------------------------------------------ */
/*  Cross-links: one click between the two zones                       */
/* ------------------------------------------------------------------ */

export interface CrossLink {
  /** Destination route. */
  to: string;
  /** Link text (terminology-locked). */
  label: string;
}

/**
 * For each view, the matching view in the other zone. Platform views point
 * at the research evidence behind them ("see the data"); research views
 * point back into the platform ("try this yourself"). Pairings follow the
 * page map's binding cross-link table.
 */
export const CROSS_LINKS: Record<string, CrossLink> = {
  // Platform → research (see the evidence behind this)
  '/platform': { to: '/explainer', label: 'See the full walkthrough' },
  '/platform/forecast': { to: '/explainer', label: 'See how scoring works' },
  '/platform/market': { to: '/evidence', label: 'See the wind evidence' },
  '/platform/stress': { to: '/robustness', label: 'See the adversary catalogue' },
  '/platform/account': { to: '/evidence', label: 'See the evidence' },
  '/platform/leaderboard': { to: '/evidence', label: 'See the skill ordering' },
  '/platform/operator': { to: '/evidence', label: 'See wind versus electricity' },
  // Research → platform (try this yourself)
  '/research': { to: '/platform', label: 'Try the platform' },
  '/evidence': { to: '/platform/market', label: 'Try it: the live market' },
  '/robustness': { to: '/platform/stress', label: 'Try it: watch an attack' },
  '/explainer': { to: '/platform', label: 'Try it: a live round' },
  '/audit': { to: '/platform/operator', label: 'Try it: the operator view' },
  '/notes': { to: '/platform', label: 'Try the platform' },
  '/appendix': { to: '/platform', label: 'Try the platform' },
  '/appendix/experiments': { to: '/platform/market', label: 'Try it: the live market' },
  '/appendix/figures': { to: '/platform', label: 'Try the platform' },
  '/appendix/diagnostics': { to: '/platform/operator', label: 'Try it: the operator view' },
};

/**
 * The contextual cross-link for a route, falling back to the zone default
 * so every view has a tasteful one-click path to the other zone.
 */
export function crossLinkForPath(pathname: string): CrossLink {
  const exact = CROSS_LINKS[pathname];
  if (exact) return exact;
  return zoneForPath(pathname) === 'platform'
    ? { to: '/evidence', label: 'See the evidence' }
    : { to: '/platform', label: 'Try the platform' };
}
