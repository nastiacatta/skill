import type { DGPId } from '@/lib/coreMechanism/dgpSimulator';

/**
 * Panel-type framings shared by the Market and Operator views (P2 decision,
 * Option B). Each framing chooses which synthetic regime drives the live
 * sandbox and links to the matching verified real-data evidence. The framing
 * is an analogue, never a claim that the live data is the wind or electricity
 * series. The mechanism, the maths and every displayed trace value stay
 * identical and synthetic across framings.
 *
 * Three panel types, each an analogue of a verified real-data series: the
 * heterogeneous wind panel, the near-homogeneous electricity panel, and the
 * chemistry-transport CAMS air-quality panel. The chemistry framing reuses the
 * existing heterogeneous regime (the real CAMS panel is strongly
 * heterogeneous), so it adds no new simulator and no new maths. The live run
 * stays synthetic; the real CAMS headline lives on the evidence surface only.
 */
export interface PanelFraming {
  id: 'heterogeneous' | 'homogeneous' | 'chemistry_moe';
  /** Selector button text (the panel-type label, kept as a sublabel). */
  label: string;
  /** Domain name that leads the Market selector button, in the visitor's
   *  vocabulary. Matches the matching `CLIENT_DOMAINS` title verbatim so one
   *  vocabulary reads across the landing chooser and the in-Market control.
   *  Additive: existing readers that only use `label` are unaffected. */
  domainLabel: string;
  /** Which synthetic regime drives the live sandbox. */
  dgpId: DGPId;
  /** One-line caption under the selector. */
  note: string;
  /** Deep-link to the matching real-data evidence. */
  evidenceHref: string;
  /** Evidence link text. */
  evidenceText: string;
  /** Optional default panel size for the deep-linked Market. Absent leaves the
   *  Market on its existing default. Additive; wind/electricity omit it. */
  defaultN?: number;
}

export const PANEL_FRAMINGS: PanelFraming[] = [
  {
    id: 'heterogeneous',
    label: 'Heterogeneous panel',
    domainLabel: 'Offshore wind',
    dgpId: 'latent_fixed',
    note: 'Forecasters differ in precision - like the wind panel.',
    evidenceHref: '#/evidence',
    evidenceText: 'See the verified wind result (mechanism vs uniform, -7.1%) in the evidence',
  },
  {
    id: 'homogeneous',
    label: 'Near-homogeneous panel',
    domainLabel: 'Electricity imbalance',
    dgpId: 'baseline',
    note: 'Forecasters are similar - like the electricity panel.',
    evidenceHref: '#/evidence',
    evidenceText: 'See the electricity null result (mechanism ties uniform) in the evidence',
  },
  {
    id: 'chemistry_moe',
    label: 'Chemistry-transport panel',
    domainLabel: 'Air quality and chemistry',
    dgpId: 'latent_fixed',
    note: 'Independently built models differ in physics - like the CAMS air-quality panel.',
    evidenceHref: '#/evidence',
    evidenceText: 'See the verified CAMS air-quality result (mechanism vs uniform) in the evidence',
    defaultN: 12,
  },
];

export const DEFAULT_FRAMING = PANEL_FRAMINGS[0]; // heterogeneous / wind-like

/**
 * Start-of-platform client / domain chooser (Q1 decision, refining P2).
 *
 * A visitor-facing layer over the same two synthetic framings above, plus one
 * evidence-only domain. This is additive: the `PanelFraming` interface and
 * `PANEL_FRAMINGS` array are untouched in shape, so the Market and Operator
 * views keep working. The chooser maps the visitor's vocabulary (clients /
 * domains) onto P2's panel-type ids, never a new synthetic regime, a new data
 * file, or a new route.
 *
 * Two honest behaviours, never blurred:
 *  - `mode: 'live'` (wind, electricity, air quality) sets the framing of the
 *    synthetic sandbox and deep-links to that domain's verified evidence. The
 *    live panel is a synthetic analogue "shaped like" the real one, never the
 *    real series.
 *  - `mode: 'evidence'` routes to the thesis result only, with no `framingId`
 *    and no simulator route. (No domain uses this mode today; all three are
 *    live with a synthetic analogue.)
 *
 * Every live card carries a quiet secondary link to that domain's verified
 * evidence, in the same footer slot, so the three card footers align and the
 * evidence link reads as an intentional per-card element rather than a dangling
 * extra. The link wording stays neutral with no percentage on the card face;
 * the verified numbers live on the evidence surface.
 */
export interface ClientDomain {
  id: 'wind' | 'electricity' | 'air_quality';
  /** Card title in the visitor's vocabulary. */
  title: string;
  /** One-line task sentence in the draft's terms. */
  task: string;
  /** Colour accent - a SEM token key, never a hex literal. */
  accent: 'aggregate' | 'wager' | 'skill';
  /** 'live' drives the synthetic sandbox; 'evidence' routes to the thesis result only. */
  mode: 'live' | 'evidence';
  /** For live domains: which P2 framing it maps to. Absent for evidence-only. */
  framingId?: PanelFraming['id'];
  /** Primary action label. */
  cta: string;
  /** Primary action href (Market with the framing preselected, or evidence). */
  href: string;
  /** The honest provenance tag shown above the note. */
  tag: string;
  /** The honest caption shown on the card. */
  honestNote: string;
  /** Secondary action: a quiet link to that domain's verified evidence, shown
   *  beneath the primary CTA in the same footer slot on every live card so the
   *  three footers align. Neutral wording, no percentage on the card face. */
  secondaryHref?: string;
  secondaryText?: string;
}

export const CLIENT_DOMAINS: ClientDomain[] = [
  {
    id: 'wind',
    title: 'Offshore wind',
    task: 'Forecast the offshore-wind power feeding the operator reserve sizing.',
    accent: 'aggregate',
    mode: 'live',
    framingId: 'heterogeneous',
    cta: 'Watch a wind-like panel',
    href: '#/platform/market?panel=heterogeneous',
    tag: 'Live synthetic sandbox',
    honestNote:
      'Live panel is a synthetic sandbox shaped like the wind panel - not the Elia wind series. The verified -7.1% is in the evidence.',
    secondaryHref: '#/evidence',
    secondaryText: 'See the verified wind evidence',
  },
  {
    id: 'electricity',
    title: 'Electricity imbalance',
    task: 'Forecast the imbalance price consumed on the settlement side.',
    accent: 'wager',
    mode: 'live',
    framingId: 'homogeneous',
    cta: 'Watch a near-homogeneous panel',
    href: '#/platform/market?panel=homogeneous',
    tag: 'Live synthetic sandbox',
    honestNote:
      'Live panel is a synthetic sandbox shaped like the electricity panel. The mechanism ties uniform here by design. See the verified null in the evidence.',
    secondaryHref: '#/evidence',
    secondaryText: 'See the verified electricity evidence',
  },
  {
    id: 'air_quality',
    title: 'Air quality and chemistry',
    task: 'Forecast hourly PM2.5 from a panel of independent chemistry-transport models.',
    accent: 'skill',
    mode: 'live',
    framingId: 'chemistry_moe',
    cta: 'Watch a chemistry-transport panel',
    href: '#/platform/market?panel=chemistry_moe',
    tag: 'Live synthetic sandbox',
    honestNote:
      'Live panel is a synthetic sandbox shaped like a chemistry-transport panel, not the real CAMS series. The verified CAMS result is in the evidence.',
    secondaryHref: '#/evidence',
    secondaryText: 'See the verified CAMS evidence',
  },
];

export const DEFAULT_DOMAIN = CLIENT_DOMAINS[0]; // wind
