import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY, FIGURE_FRAME } from './shared/presentationConstants';

const BASE = import.meta.env.BASE_URL;

/**
 * Slide 10 — Synthetic Validation: Convergence.
 *
 * Shows the R-generated skill convergence plot with a Spearman ρ badge
 * and a brief reward-distribution summary.
 */
export default function SyntheticResultsSlide() {
  return (
    <SlideShell title="Synthetic Validation: Convergence" slideNumber={9}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: TYPOGRAPHY.fontFamily,
          minHeight: 0,
        }}
      >
        {/* ── Header row: description + badges ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize: '1.15rem',
              color: PALETTE.charcoal,
              margin: 0,
              lineHeight: 1.5,
              maxWidth: '60%',
            }}
          >
            Six forecasters with known noise levels, 20,000 rounds. The mechanism correctly
            learns the true ranking.
          </p>

          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {/* Spearman ρ badge */}
            <div
              style={{
                background: PALETTE.teal,
                color: PALETTE.white,
                fontSize: '1.05rem',
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 20,
              }}
            >
              Spearman ρ = 1.0
            </div>

            {/* Reward distribution badge */}
            <div
              style={{
                background: 'rgba(46, 139, 139, 0.10)',
                color: PALETTE.teal,
                fontSize: '1.05rem',
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 20,
                border: `1.5px solid ${PALETTE.teal}`,
              }}
            >
              Noise-skill r = −0.98
            </div>
          </div>
        </div>

        {/* ── Main image: skill convergence plot (≥70% of content area) ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            ...FIGURE_FRAME,
          }}
        >
          <img
            src={`${BASE}presentation-plots/quantiles_crps_recovery.png`}
            alt="Skill convergence: true noise vs learned skill showing perfect rank correlation across 20,000 rounds"
            style={{
              flex: 1,
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />
        </div>

        {/* ── Bottom: reward distribution summary ── */}
        <div
          style={{
            flexShrink: 0,
            marginTop: 10,
            background: 'rgba(46, 139, 139, 0.07)',
            borderLeft: `4px solid ${PALETTE.teal}`,
            padding: '10px 20px',
            borderRadius: '0 12px 12px 0',
          }}
        >
          <span
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: PALETTE.navy,
              lineHeight: 1.5,
            }}
          >
            Skilled forecasters earn more, noise-skill correlation r = −0.98
          </span>
        </div>
      </div>
    </SlideShell>
  );
}
