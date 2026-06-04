import { useState, useEffect, useCallback } from 'react';
import PasswordGate from '@/components/slides/PasswordGate';
import { PALETTE, TYPOGRAPHY, DARK_GRADIENT, getSectionForSlide, SECTION_BAR_HEIGHT, MAIN_DECK_SLIDE_COUNT, SLIDE_PAGE_PADDING, DIAGRAM_PANEL } from '@/components/slides/shared/presentationConstants';
import { formatBulletText } from '@/components/slides/shared/formatBulletText';
import TheoryFlowSlide from '@/components/slides/TheoryFlowSlide';
import MarketFlowSlide from '@/components/slides/MarketFlowSlide';
import PositioningMatrixSlide from '@/components/slides/PositioningMatrixSlide';
import ContributionSlide from '@/components/slides/ContributionSlide';
import MechanismPipelineSlide from '@/components/slides/MechanismPipelineSlide';
import SkillSignalSlide from '@/components/slides/SkillSignalSlide';
import ContributionsChartSlide from '@/components/slides/ContributionsChartSlide';
import ModelsDataOverviewSlide from '@/components/slides/ModelsDataOverviewSlide';
import SyntheticResultsSlide from '@/components/slides/SyntheticResultsSlide';
import ConclusionSlide from '@/components/slides/ConclusionSlide';
import StrategicRobustnessSlide from '@/components/slides/StrategicRobustnessSlide';
import BaselineComparisonSlide from '@/components/slides/BaselineComparisonSlide';
import AppendixSlide from '@/components/slides/AppendixSlide';
import TitleSlide from '@/components/slides/TitleSlide';
import WhyOrderingSlide from '@/components/slides/methodology/WhyOrderingSlide';

/**
 * Full-screen presentation mode for project defence.
 * Academic styling with section indicators, slide numbers, and new palette.
 */

const C = PALETTE;
const FONT_FAMILY = TYPOGRAPHY.fontFamily;
const TOTAL_SLIDES = MAIN_DECK_SLIDE_COUNT;

/* ─── Slide data ─────────────────────────────────────────────── */

export interface SlideComponentProps {
  slide: SlideData;
  palette: typeof PALETTE;
  fontFamily: string;
}

export interface SlideData {
  id: string;
  type: 'title' | 'section' | 'content' | 'split' | 'closing';
  title?: string;
  subtitle?: string;
  bullets?: string[];
  leftBullets?: string[];
  image?: string;
  highlight?: string;
  dark?: boolean;
  ref?: string;
  slideNumber?: number;
  component?: React.ComponentType<SlideComponentProps>;
  rightComponent?: React.ComponentType<SlideComponentProps>;
}

const SLIDES: SlideData[] = [
  /* 1 — Title */
  {
    id: 'title',
    type: 'section',
    title: 'Self-Financed Prediction Markets\nwith Skill-Weighted Stakes',
    subtitle: 'A weighted-score wagering mechanism with an online skill-estimation layer',
    dark: true,
    component: TitleSlide,
    slideNumber: 1,
  },
  /* 2 — What Is a Prediction Market? */
  {
    id: 'what-is-pm',
    type: 'split',
    title: 'What Is a Prediction Market?',
    bullets: [
      '▸ A client needs a forecast of something uncertain, say tomorrow\u2019s wind power output',
      '▸ The client posts the task on a platform and attaches a reward',
      '▸ Forecasters each submit a forecast and back it with a wager',
      '▸ The platform aggregates the forecasts into a single market forecast',
      '▸ Once the outcome is observed, the platform redistributes the wagers by accuracy',
      '',
      '→ The platform crowdsources information without asking anyone to share their raw data',
    ],
    ref: 'Wolfers & Zitzewitz, 2004 · Raja et al., 2024',
    rightComponent: TheoryFlowSlide,
    slideNumber: 2,
  },
  /* 3 — Why Combine Forecasts? */
  {
    id: 'why-combine',
    type: 'split',
    title: 'Why Combine Forecasts?',
    bullets: [
      '▸ Different forecasters contribute different information',
      '▸ Aggregation is often stronger than single-source prediction',
      '',
      '▸ A market adds incentives and an aggregation rule',
      '▸ Equal weighting ignores information about contribution quality',
      '',
      '→ How should the market learn how much weight each contribution should receive?',
    ],
    ref: 'Wolfers & Zitzewitz, 2004',
    rightComponent: MarketFlowSlide,
    slideNumber: 3,
  },
  /* 4 — Where This Work Fits */
  {
    id: 'literature',
    type: 'content',
    title: 'Where This Work Fits',
    component: PositioningMatrixSlide,
    slideNumber: 4,
  },
  /* 5 — My Contribution */
  {
    id: 'contribution',
    type: 'section',
    title: 'My Contribution',
    subtitle:
      'A prediction market that is both self-financed and adaptive.\nWeight in the aggregate depends on deposit and learned skill.',
    dark: true,
    component: ContributionSlide,
    slideNumber: 5,
  },
  /* 6 — Mechanism: Round-by-Round */
  {
    id: 'mechanism',
    type: 'content',
    title: 'Mechanism: Round-by-Round',
    component: MechanismPipelineSlide,
    slideNumber: 6,
  },
  /* 7 — The Skill Signal */
  {
    id: 'skill-layer',
    type: 'split',
    title: 'The Skill Signal',
    bullets: [
      '▸ Skill σ_i is how well forecaster i has been performing recently, on a 0-to-1 scale',
      '▸ “Adaptive skill” means σ_i is re-estimated every round from realised loss',
      '▸ It is absolute, not relative. One forecaster improving does not push others down',
      '',
      '▸ Implementation: exponentially-weighted moving average of loss, mapped to [σ_min, 1]',
      '▸ σ_min keeps everyone in the market. Staleness decay pulls absent forecasters toward baseline',
    ],
    rightComponent: SkillSignalSlide,
    slideNumber: 7,
  },
  /* 8 — Models, Data, and Synthetic Setup */
  {
    id: 'models-data',
    type: 'content',
    title: 'Models, Data, and Synthetic Setup',
    component: ModelsDataOverviewSlide,
    slideNumber: 8,
  },
  /* 9 — Synthetic Validation: Convergence */
  {
    id: 'synthetic-results',
    type: 'content',
    title: 'Synthetic Validation: Convergence',
    component: SyntheticResultsSlide,
    slideNumber: 9,
  },
  /* 10 — Real Data: Elia Wind */
  {
    id: 'real-data',
    type: 'content',
    title: 'Real Data: Elia Wind + Electricity',
    component: ContributionsChartSlide,
    slideNumber: 10,
  },
  /* 11 — Benchmark comparison vs prior work */
  {
    id: 'baseline-comparison',
    type: 'content',
    title: 'Benchmark: CRPS Comparison',
    component: BaselineComparisonSlide,
    slideNumber: 11,
  },
  /* 12 — Strategic Robustness */
  {
    id: 'strategic-robustness',
    type: 'content',
    title: 'Strategic Robustness',
    component: StrategicRobustnessSlide,
    slideNumber: 12,
  },
  /* 13 — Conclusion + Future Work */
  {
    id: 'conclusion',
    type: 'closing',
    title: 'Conclusion + Future Work',
    dark: true,
    component: ConclusionSlide,
    slideNumber: 13,
  },
  /* Appendix — hidden backup slide, no slide number */
  {
    id: 'appendix',
    type: 'content',
    title: 'Appendix',
    component: AppendixSlide,
    slideNumber: undefined,
  },
  /* Backup slide — lives after the appendix. No slide number, no section bar.
     Answers the Slide 10 question (why validate the mechanism by ordering rather
     than CRPS). This is plain academic content, not a code-change log. */
  {
    id: 'why-ordering',
    type: 'content',
    title: 'Why validate by ordering, not CRPS?',
    component: WhyOrderingSlide,
    slideNumber: undefined,
  },
];

/* ─── Section bar component ──────────────────────────────────── */

function SectionBar({ slideNumber }: { slideNumber?: number }) {
  if (!slideNumber) return null;
  const section = getSectionForSlide(slideNumber);
  if (!section.colour || section.colour === 'transparent') return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SECTION_BAR_HEIGHT,
        background: section.colour,
        zIndex: 10,
      }}
    />
  );
}

/* ─── Slide number indicator ─────────────────────────────────── */

function SlideNumberBadge({ slideNumber, dark }: { slideNumber?: number; dark?: boolean }) {
  if (!slideNumber) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 18,
        right: 28,
        fontSize: '0.8125rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        color: dark ? PALETTE.darkText : PALETTE.navy,
        fontFamily: FONT_FAMILY,
        zIndex: 10,
        padding: '6px 14px',
        borderRadius: 999,
        background: dark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.92)',
        border: dark ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${PALETTE.border}`,
        boxShadow: dark ? 'none' : '0 2px 10px rgba(27, 42, 74, 0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {slideNumber} / {TOTAL_SLIDES}
    </div>
  );
}

/* ─── Section label ──────────────────────────────────────────── */

function SectionLabel({ slideNumber, dark }: { slideNumber?: number; dark?: boolean }) {
  if (!slideNumber) return null;
  const section = getSectionForSlide(slideNumber);
  if (!section.label) return null;
  return (
    <div
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: dark ? PALETTE.darkText : PALETTE.slate,
        marginBottom: 10,
        fontFamily: FONT_FAMILY,
        opacity: 0.85,
      }}
    >
      {section.label}
    </div>
  );
}

/* ─── Shared style helpers ───────────────────────────────────── */

function AccentBar() {
  return (
    <div
      style={{
        width: 64,
        height: 3,
        background: C.teal,
        borderRadius: 2,
        marginTop: 12,
        opacity: 0.9,
      }}
    />
  );
}

function SlideFooter({ refText }: { refText?: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        paddingTop: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: C.slate }}>
        Anastasia Cattaneo — Imperial College London
      </span>
      {refText && (
        <span
          style={{
            fontSize: '0.8125rem',
            color: C.slate,
            marginLeft: 'auto',
            paddingLeft: 16,
            textAlign: 'right',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {refText}
        </span>
      )}
    </div>
  );
}

function HighlightBar({ text }: { text: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        marginTop: 20,
        background: 'rgba(46, 139, 139, 0.07)',
        borderLeft: `6px solid ${C.teal}`,
        color: C.navy,
        fontSize: '1.35rem',
        fontWeight: 700,
        padding: '0.9rem 1.5rem',
        borderRadius: '0 12px 12px 0',
        lineHeight: 1.45,
      }}
    >
      {text}
    </div>
  );
}

/** Per-bullet inline style */
function bulletStyle(item: string): React.CSSProperties {
  if (item === '') return { height: '0.6rem' };
  if (item.startsWith('→')) return { color: C.teal, fontWeight: 700 };
  // Warning triangles — coral
  if (item.startsWith('▲')) return { color: C.coral, fontWeight: 600 };
  // Filled circle — teal property badges
  if (item.startsWith('●')) return { color: C.teal, fontWeight: 700 };
  // Teal arrow bullets
  if (item.startsWith('▸')) return { color: C.charcoal };
  // Slate secondary bullets
  if (item.startsWith('▹')) return { color: C.slate };
  // Legacy warning styles
  if (item.startsWith('• Warning:')) return { color: C.coral, fontWeight: 600 };
  if (item.startsWith('⚠')) return { color: C.coral, fontWeight: 600 };
  if (item.startsWith('  [!]')) return { color: C.coral, fontWeight: 600, paddingLeft: '1.5rem' };
  if (item.startsWith('[!]')) return { color: C.coral, fontWeight: 600 };
  if (item.startsWith('    ')) return { paddingLeft: '2.5rem', fontSize: '1.5rem', color: C.slate };
  if (item.startsWith('  ')) return { paddingLeft: '0.5rem' };
  if (/^\d\./.test(item)) return { fontWeight: 600 };
  if (item.startsWith('Limitations:'))
    return { fontWeight: 700, fontSize: '1.6rem', color: C.navy, marginTop: '0.4rem' };
  if (item.startsWith('Fixed deposits:') || item.startsWith('Bankroll deposits:'))
    return { fontWeight: 700, color: C.charcoal };
  return {};
}

const darkGradient = DARK_GRADIENT;

/* ─── Slide view components ──────────────────────────────────── */

/** Section slide (dark, centred) */
function SectionSlideView({ slide }: { slide: SlideData }) {
  if (slide.component) {
    const Comp = slide.component;
    /* Title slide: full-bleed art; render chrome above so section bar + slide number stay visible */
    if (slide.id === 'title') {
      return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <Comp slide={slide} palette={PALETTE} fontFamily={FONT_FAMILY} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <SectionBar slideNumber={slide.slideNumber} />
            <SlideNumberBadge slideNumber={slide.slideNumber} dark />
          </div>
        </div>
      );
    }
    return <Comp slide={slide} palette={PALETTE} fontFamily={FONT_FAMILY} />;
  }
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px',
        background: darkGradient,
        fontFamily: FONT_FAMILY,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <SectionBar slideNumber={slide.slideNumber} />
      <SlideNumberBadge slideNumber={slide.slideNumber} dark />
      <SectionLabel slideNumber={slide.slideNumber} dark />
      <h1
        style={{
          fontSize: TYPOGRAPHY.heading.fontSize,
          fontWeight: 700,
          color: C.white,
          lineHeight: 1.2,
          marginBottom: 24,
          letterSpacing: '-0.01em',
        }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p
          style={{
            fontSize: '1.4rem',
            color: C.darkText,
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
            maxWidth: 820,
            fontWeight: 400,
          }}
        >
          {slide.subtitle}
        </p>
      )}
    </div>
  );
}

/** Content slide (full-width bullets + optional component) */
function ContentSlideView({ slide }: { slide: SlideData }) {
  if (slide.component) {
    const Comp = slide.component;
    const inner = <Comp slide={slide} palette={PALETTE} fontFamily={FONT_FAMILY} />;
    /* Appendix and the why-ordering backup slide are scrollable; stop click-to-advance from swallowing them */
    const interactiveSlideIds = new Set([
      'appendix',
      'why-ordering',
    ]);
    if (interactiveSlideIds.has(slide.id)) {
      return (
        <div
          style={{ width: '100%', height: '100%', position: 'relative' }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {inner}
        </div>
      );
    }
    return inner;
  }
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        ...SLIDE_PAGE_PADDING,
        background: C.offWhite,
        fontFamily: FONT_FAMILY,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <SectionBar slideNumber={slide.slideNumber} />
      <SlideNumberBadge slideNumber={slide.slideNumber} />
      <div style={{ flexShrink: 0, marginBottom: 26 }}>
        <SectionLabel slideNumber={slide.slideNumber} />
        <h2
          style={{
            fontSize: TYPOGRAPHY.heading.fontSize,
            fontWeight: TYPOGRAPHY.heading.fontWeight,
            color: C.navy,
            lineHeight: TYPOGRAPHY.heading.lineHeight,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {slide.title}
        </h2>
        <AccentBar />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {slide.bullets && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {slide.bullets.map((item, i) => (
              <li
                key={i}
                style={{
                  fontSize: TYPOGRAPHY.bodyContent.fontSize,
                  lineHeight: TYPOGRAPHY.bodyContent.lineHeight,
                  marginBottom: TYPOGRAPHY.bodyContent.marginBottom,
                  color: C.charcoal,
                  fontFamily: FONT_FAMILY,
                  ...bulletStyle(item),
                }}
              >
                {formatBulletText(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {slide.highlight && <HighlightBar text={slide.highlight} />}
      <SlideFooter refText={slide.ref} />
    </div>
  );
}

/** Split slide (left bullets + right component) */
function SplitSlideView({ slide }: { slide: SlideData }) {
  if (slide.component && !slide.rightComponent) {
    const Comp = slide.component;
    return <Comp slide={slide} palette={PALETTE} fontFamily={FONT_FAMILY} />;
  }
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        ...SLIDE_PAGE_PADDING,
        background: C.offWhite,
        fontFamily: FONT_FAMILY,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <SectionBar slideNumber={slide.slideNumber} />
      <SlideNumberBadge slideNumber={slide.slideNumber} />
      <div style={{ flexShrink: 0, marginBottom: 26 }}>
        <SectionLabel slideNumber={slide.slideNumber} />
        <h2
          style={{
            fontSize: TYPOGRAPHY.heading.fontSize,
            fontWeight: TYPOGRAPHY.heading.fontWeight,
            color: C.navy,
            lineHeight: TYPOGRAPHY.heading.lineHeight,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {slide.title}
        </h2>
        <AccentBar />
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 48, minHeight: 0 }}>
        {/* Left: bullets */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {slide.bullets && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {slide.bullets.map((item, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: TYPOGRAPHY.bodySplit.fontSize,
                    lineHeight: TYPOGRAPHY.bodySplit.lineHeight,
                    marginBottom: TYPOGRAPHY.bodySplit.marginBottom,
                    color: C.charcoal,
                    fontFamily: FONT_FAMILY,
                    ...bulletStyle(item),
                  }}
                >
                  {formatBulletText(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Right: component */}
        {slide.rightComponent && (
          <div style={DIAGRAM_PANEL}>
            <slide.rightComponent slide={slide} palette={PALETTE} fontFamily={FONT_FAMILY} />
          </div>
        )}
      </div>
      {slide.highlight && <HighlightBar text={slide.highlight} />}
      <SlideFooter refText={slide.ref} />
    </div>
  );
}

/** Closing slide */
function ClosingSlideView({ slide }: { slide: SlideData }) {
  if (slide.component) {
    const Comp = slide.component;
    return <Comp slide={slide} palette={PALETTE} fontFamily={FONT_FAMILY} />;
  }
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px',
        background: darkGradient,
        fontFamily: FONT_FAMILY,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <SectionBar slideNumber={slide.slideNumber} />
      <SlideNumberBadge slideNumber={slide.slideNumber} dark />
      <h1
        style={{
          fontSize: '3.6rem',
          fontWeight: 700,
          color: C.white,
          marginBottom: 32,
          letterSpacing: '-0.01em',
        }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p
          style={{
            fontSize: '1.4rem',
            color: C.darkText,
            lineHeight: 1.8,
            whiteSpace: 'pre-line',
            fontWeight: 400,
          }}
        >
          {slide.subtitle}
        </p>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */

export default function PresentationPage() {
  const [current, setCurrent] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  if (!authenticated) {
    return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;
  }

  const slide = SLIDES[current];

  let content: React.ReactNode;
  switch (slide.type) {
    case 'section':
      content = <SectionSlideView slide={slide} />;
      break;
    case 'content':
      content = <ContentSlideView slide={slide} />;
      break;
    case 'split':
      content = <SplitSlideView slide={slide} />;
      break;
    case 'closing':
      content = <ClosingSlideView slide={slide} />;
      break;
    default:
      content = <ContentSlideView slide={slide} />;
  }

  return (
    <div
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', cursor: 'none' }}
      onClick={next}
      onContextMenu={(e) => { e.preventDefault(); prev(); }}
    >
      {content}
    </div>
  );
}
