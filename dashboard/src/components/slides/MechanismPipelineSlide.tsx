import katex from 'katex';
import 'katex/dist/katex.min.css';
import { PALETTE, TYPOGRAPHY, getSectionForSlide, SECTION_BAR_HEIGHT, MAIN_DECK_SLIDE_COUNT, SLIDE_PAGE_PADDING } from './shared/presentationConstants';

/**
 * Slide 7: Mechanism Round-by-Round — horizontal pipeline with
 * plain-English labels ABOVE each formula box. Arrows have 15px gaps.
 * Feedback arrow is BELOW the boxes with proper clearance.
 */

const FONT_FAMILY = TYPOGRAPHY.fontFamily;

interface StepConfig {
  id: string;
  label: string;
  description: string;
  latex: string;
  emphasised?: boolean;
}

/**
 * All multiplication uses \cdot explicitly. Juxtaposition is reserved for
 * function application (f(x)) and for implicit products that are conventional
 * in physics notation (e.g. dx / dt). This keeps the deck visually consistent
 * when the audience scans multiple formulas in a row.
 */
const STEPS: StepConfig[] = [
  {
    id: 'submit',
    label: '1. Submit',
    description: 'Forecaster submits a quantile forecast and a deposit',
    latex: 'q_i(\\tau),\\; b_i',
  },
  {
    id: 'wager',
    label: '2. Effective Wager',
    description: 'Deposit is scaled by a learned skill factor',
    latex: 'm_i \\;=\\; b_i \\cdot g(\\sigma_i)',
    emphasised: true,
  },
  {
    id: 'aggregate',
    label: '3. Aggregate',
    description: 'Weighted average of forecasters, weighted by effective wager',
    latex: '\\hat{q}(\\tau) \\;=\\; \\sum_i w_i \\cdot q_i(\\tau)',
  },
  {
    id: 'settle',
    label: '4. Settle',
    description: 'Winners paid from losers, pool is budget balanced by construction',
    latex: '\\Pi_i \\;=\\; m_i \\cdot \\bigl(1 + s_i - \\bar{s}\\bigr)',
  },
  {
    id: 'skill',
    label: '5. Skill Update',
    description: 'Realised loss feeds back into the skill factor for the next round',
    latex: '\\sigma_i \\;=\\; \\sigma_{\\min} + (1-\\sigma_{\\min}) \\cdot e^{-\\gamma \\cdot L_i}',
  },
];

function renderLatex(latex: string): string {
  return katex.renderToString(latex, { throwOnError: false, displayMode: true });
}

function StepBox({ step }: { step: StepConfig }) {
  const isEmphasised = step.emphasised === true;

  return (
    <div
      style={{
        background: isEmphasised ? 'rgba(46, 139, 139, 0.05)' : PALETTE.white,
        border: isEmphasised ? `2.5px solid ${PALETTE.teal}` : `1.5px solid ${PALETTE.border}`,
        borderRadius: 14,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        minWidth: 0,
        flex: 1,
      }}
      data-testid={`step-${step.id}`}
    >
      {/* Label (title) */}
      <div
        style={{
          fontSize: '1.45rem',
          fontWeight: 700,
          color: PALETTE.navy,
          marginBottom: 10,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.2,
        }}
      >
        {step.label}
      </div>
      {/* Formula */}
      <div
        style={{ fontSize: '1.05rem', lineHeight: 1.4, marginBottom: 10 }}
        dangerouslySetInnerHTML={{ __html: renderLatex(step.latex) }}
      />
      {/* Plain-English description */}
      <div
        style={{
          fontSize: '0.92rem',
          color: PALETTE.slate,
          fontStyle: 'italic',
          fontFamily: FONT_FAMILY,
          lineHeight: 1.35,
        }}
      >
        {step.description}
      </div>
    </div>
  );
}

function ArrowDivider({ highlight = false }: { highlight?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
        flexShrink: 0,
      }}
    >
      <svg width="32" height="24" viewBox="0 0 32 24">
        <path
          d="M2 12 L22 12 M17 6 L24 12 L17 18"
          stroke={highlight ? PALETTE.teal : PALETTE.border}
          strokeWidth={highlight ? 3 : 2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function FeedbackArrow() {
  // The arrow represents the round→round loop: after settle + skill update,
  // the new σ_i enters step 2 of the *next* round. We draw a curved path so
  // it reads as "next round" rather than a confusing in-round loop.
  return (
    <div style={{ position: 'relative', width: '100%', height: 64, marginTop: 14 }}>
      <svg
        viewBox="0 0 1000 64"
        style={{ width: '100%', height: '100%' }}
        preserveAspectRatio="none"
      >
        <defs>
          <marker id="feedback-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={PALETTE.teal} />
          </marker>
        </defs>
        {/* Curved path: start below step 5 (right), loop down, end below step 2 (left) */}
        <path
          d="M 900 6 C 900 48, 300 48, 300 6"
          fill="none"
          stroke={PALETTE.teal}
          strokeWidth="2.5"
          strokeDasharray="8 5"
          markerEnd="url(#feedback-arrow)"
          vectorEffect="non-scaling-stroke"
        />
        <text
          x="600" y="58"
          fill={PALETTE.teal}
          fontSize="13"
          fontWeight="600"
          fontFamily={FONT_FAMILY}
          fontStyle="italic"
          textAnchor="middle"
        >
          updated skill feeds back into the effective wager in the next round
        </text>
      </svg>
    </div>
  );
}

export default function MechanismPipelineSlide() {
  const section = getSectionForSlide(6);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        ...SLIDE_PAGE_PADDING,
        background: PALETTE.offWhite,
        fontFamily: FONT_FAMILY,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Section bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SECTION_BAR_HEIGHT, background: section.colour }} />
      {/* Slide number */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 28,
          zIndex: 5,
          fontSize: '0.8125rem',
          fontWeight: 600,
          letterSpacing: '0.03em',
          color: PALETTE.navy,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.92)',
          border: `1px solid ${PALETTE.border}`,
          boxShadow: '0 2px 10px rgba(27, 42, 74, 0.06)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {`6 / ${MAIN_DECK_SLIDE_COUNT}`}
      </div>

      {/* Title */}
      <div style={{ flexShrink: 0, marginBottom: 20 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: PALETTE.slate, marginBottom: 8, opacity: 0.8 }}>
          SOLUTION
        </div>
        <h2 style={{ fontSize: '3.2rem', fontWeight: 700, color: PALETTE.navy, lineHeight: 1.15, margin: 0 }}>
          Mechanism: Round-by-Round
        </h2>
        <div style={{ width: 64, height: 3, background: PALETTE.teal, borderRadius: 2, marginTop: 12, opacity: 0.9 }} />
      </div>

      {/* Steps */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {STEPS.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <StepBox step={step} />
              {i < STEPS.length - 1 && <ArrowDivider highlight={step.id === 'wager'} />}
            </div>
          ))}
        </div>
        <FeedbackArrow />
      </div>

      {/* Insight banner — two takeaways, with explicit reward-sharing line */}
      <div
        style={{
          flexShrink: 0,
          marginTop: 12,
          background: 'rgba(46, 139, 139, 0.08)',
          border: '1px solid rgba(46, 139, 139, 0.25)',
          borderLeft: `4px solid ${PALETTE.teal}`,
          borderRadius: 8,
          padding: '12px 24px',
          fontFamily: FONT_FAMILY,
          lineHeight: 1.4,
          color: PALETTE.navy,
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
          Same effective wager controls aggregation weight and financial exposure.
        </div>
        <div style={{ fontSize: '1.05rem', marginTop: 4, color: PALETTE.charcoal }}>
          Reward sharing: each forecaster’s score is taken relative to the market mean, so winners are paid from losers and the pool is self-financed.
        </div>
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: '0.8rem', color: PALETTE.slate }}>Anastasia Cattaneo — Imperial College London</span>
      </div>
    </div>
  );
}
