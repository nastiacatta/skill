import katex from 'katex';
import 'katex/dist/katex.min.css';
import { PALETTE, TYPOGRAPHY, DARK_GRADIENT, getSectionForSlide, SECTION_BAR_HEIGHT, MAIN_DECK_SLIDE_COUNT } from './shared/presentationConstants';

/**
 * Slide 6: My Contribution — dark background with KaTeX equation
 * and three property badges. No emojis.
 */
export default function ContributionSlide() {
  const equationHtml = katex.renderToString('m_i = b_i \\times g(\\sigma_i)', {
    throwOnError: false,
    displayMode: true,
  });

  const properties = ['Absolute', 'Pre-round', 'Handles Intermittency'] as const;
  const section = getSectionForSlide(5);

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
        padding: '72px 64px',
        background: DARK_GRADIENT,
        fontFamily: TYPOGRAPHY.fontFamily,
        boxSizing: 'border-box',
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
          color: PALETTE.darkText,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {`5 / ${MAIN_DECK_SLIDE_COUNT}`}
      </div>
      {/* Section label */}
      <div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: PALETTE.darkText, marginBottom: 18, opacity: 0.88 }}>
        PROBLEM
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '3.45rem',
          fontWeight: 700,
          color: PALETTE.white,
          lineHeight: 1.15,
          marginBottom: 20,
          letterSpacing: '-0.02em',
        }}
      >
        My Contribution
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '1.6rem',
          color: PALETTE.darkText,
          lineHeight: 1.6,
          maxWidth: 800,
          marginBottom: 32,
        }}
      >
        Coupling self-financed wagering with online skill learning
      </p>

      {/* Gap → resolution line (connects slide 4 to the formula) */}
      <p
        style={{
          fontSize: '1.15rem',
          color: PALETTE.darkText,
          lineHeight: 1.55,
          maxWidth: 820,
          marginBottom: 22,
          opacity: 0.92,
        }}
      >
        The gap: existing self-financed mechanisms are history-free, and existing
        adaptive ones are not self-financed. This contribution closes that gap
        with a single idea — let the wager carry the learned skill.
      </p>

      {/* Equation highlight box */}
      <div
        style={{
          background: 'rgba(46, 139, 139, 0.14)',
          border: `2px solid ${PALETTE.teal}`,
          borderRadius: 18,
          padding: '32px 52px',
          marginBottom: 40,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          style={{ fontSize: '2.2rem', color: PALETTE.white }}
          dangerouslySetInnerHTML={{ __html: equationHtml }}
        />
        <p
          style={{
            marginTop: 12,
            fontSize: '1.2rem',
            color: PALETTE.darkText,
          }}
        >
          effective wager = deposit × learned skill
        </p>
      </div>

      {/* Property badges */}
      <div style={{ display: 'flex', gap: 24 }}>
        {properties.map((prop) => (
          <div
            key={prop}
            style={{
              background: PALETTE.teal,
              color: PALETTE.white,
              fontSize: '1.1rem',
              fontWeight: 700,
              padding: '12px 28px',
              borderRadius: 30,
            }}
          >
            {prop}
          </div>
        ))}
      </div>

    </div>
  );
}
