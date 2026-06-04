import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY, FIGURE_FRAME } from './shared/presentationConstants';

const BASE = import.meta.env.BASE_URL;

export default function DepositAblationSlide() {
  return (
    <SlideShell title="Deposit Design" slideNumber={11}>
      {/* Header badge */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{ background: PALETTE.purple, color: PALETTE.white, fontSize: '1rem', fontWeight: 700, padding: '8px 18px', borderRadius: 16, fontFamily: TYPOGRAPHY.fontFamily }}>
          Deposit rule controls skill-signal reach
        </div>
      </div>

      {/* Figure — fills ≥70% of content area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...FIGURE_FRAME }}>
        <img
          src={`${BASE}presentation-plots/deposit_policy_comparison.png`}
          alt="Deposit policy comparison showing Oracle, Bankroll+Confidence, Fixed, and Random"
          style={{ flex: 1, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
        />
      </div>

      {/* Bottom note */}
      <p style={{ fontSize: '1rem', color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, marginTop: 10, textAlign: 'center', flexShrink: 0, lineHeight: 1.5 }}>
        Practical deposit rules capture most of the available gain, but we cannot control what forecasters stake
      </p>
    </SlideShell>
  );
}
