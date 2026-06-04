import SlideShell from '../shared/SlideShell';
import { PALETTE, TYPOGRAPHY, CARD_STYLE } from '../shared/presentationConstants';

/**
 * Post-appendix backup slide.
 *
 * Addresses the question raised on main-deck Slide 10 ("Real Data: Elia Wind +
 * Electricity"): "it is peculiar to want to look at ordering as a way to
 * validate the mechanism — why do it this way?"
 *
 * This slide is the standalone written answer. It is not part of the main
 * deck (slideNumber undefined in PresentationPage) and is click-propagation-safe.
 */
export default function WhyOrderingSlide() {
  return (
    <SlideShell
      title="Why validate the mechanism by ordering, not by CRPS?"
      subtitle="Answer to the Slide 10 question"
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Framing */}
        <div style={{ ...CARD_STYLE, padding: '20px 26px', background: 'rgba(27, 42, 74, 0.03)' }}>
          <p style={{ margin: 0, fontSize: '1.1rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
            The mechanism's job is <strong>not</strong> to forecast. The mechanism's job is to <strong>rank trust</strong> — to convert realised loss into a skill signal σ that is then used to weight the aggregate and settle the pool. CRPS measures forecasting accuracy. Ordering measures whether the skill layer is doing the thing it was designed to do.
          </p>
        </div>

        {/* Three reasons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

          <div style={{ ...CARD_STYLE, padding: '20px 22px', borderLeft: `4px solid ${PALETTE.teal}` }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: PALETTE.teal, fontFamily: TYPOGRAPHY.fontFamily, letterSpacing: '0.12em', marginBottom: 8 }}>
              REASON 1
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily, marginBottom: 8 }}>
              Different questions, different metrics
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.charcoal, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
              CRPS answers "is the aggregate a good forecast?" Ordering answers "does σ reflect skill?" If I used CRPS to validate σ I would be confounding two mechanisms — the aggregator and the skill layer.
            </p>
          </div>

          <div style={{ ...CARD_STYLE, padding: '20px 22px', borderLeft: `4px solid ${PALETTE.teal}` }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: PALETTE.teal, fontFamily: TYPOGRAPHY.fontFamily, letterSpacing: '0.12em', marginBottom: 8 }}>
              REASON 2
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily, marginBottom: 8 }}>
              CRPS is a weak witness of σ
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.charcoal, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
              A mechanism could match uniform CRPS by accident — e.g. by weighting several mid-skill models evenly. Ordering rules that out: if σ recovers the true ranking, the weights are informative <em>regardless</em> of the CRPS gap.
            </p>
          </div>

          <div style={{ ...CARD_STYLE, padding: '20px 22px', borderLeft: `4px solid ${PALETTE.teal}` }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: PALETTE.teal, fontFamily: TYPOGRAPHY.fontFamily, letterSpacing: '0.12em', marginBottom: 8 }}>
              REASON 3
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily, marginBottom: 8 }}>
              Incentives require correct ordering
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: PALETTE.charcoal, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
              Lambert truthfulness is conditional on σ not rewarding the wrong agents. If σ-ranking were wrong, high-skill truthful reporters could still lose — breaking the mechanism's incentive story. Correct ordering is a <em>necessary condition</em>, not a bonus property.
            </p>
          </div>

        </div>

        {/* The number */}
        <div style={{ ...CARD_STYLE, padding: '20px 26px', background: 'rgba(46, 139, 139, 0.05)', borderLeft: `5px solid ${PALETTE.teal}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: PALETTE.teal, fontFamily: TYPOGRAPHY.fontFamily, letterSpacing: '0.12em', marginBottom: 10 }}>
            THE EVIDENCE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, alignItems: 'center' }}>
            <div style={{ fontSize: '1rem', color: PALETTE.charcoal, lineHeight: 1.6, fontFamily: TYPOGRAPHY.fontFamily }}>
              Spearman rank correlation between learned σ and per-forecaster CRPS on the Elia wind audit slice.
              <br />
              <span style={{ color: PALETTE.slate, fontSize: '0.88rem' }}>Probability of Spearman = 1 by chance on n = 7 forecasters: 1 / 7! ≈ 0.02%.</span>
            </div>
            <div style={{ textAlign: 'center', padding: '18px 14px', background: PALETTE.white, borderRadius: 10, border: `1.5px solid ${PALETTE.border}` }}>
              <div style={{ fontSize: '3.2rem', fontWeight: 800, color: PALETTE.teal, fontFamily: 'monospace', lineHeight: 1 }}>1.00</div>
              <div style={{ fontSize: '0.85rem', color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, marginTop: 6 }}>Spearman(σ, CRPS)</div>
            </div>
          </div>
        </div>

        {/* Companion test */}
        <div style={{ ...CARD_STYLE, padding: '18px 24px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, letterSpacing: '0.12em', marginBottom: 8 }}>
            COMPANION: SYNTHETIC KNOWN-σ PANEL
          </div>
          <p style={{ margin: 0, fontSize: '0.97rem', color: PALETTE.charcoal, lineHeight: 1.55, fontFamily: TYPOGRAPHY.fontFamily }}>
            On the synthetic panel with ground-truth noise τ set by construction, Spearman(learned σ, true τ) = 1.00 across all five audit seeds. The real-data Spearman(σ, CRPS) = 1.00 is the same test run against the best available <em>estimate</em> of ground truth. Both checks fire before the CRPS comparison is even made.
          </p>
        </div>

      </div>
    </SlideShell>
  );
}
