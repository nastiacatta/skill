import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

const BASE = import.meta.env.BASE_URL;

export default function SkillRecoverySlide() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
        <p style={{ fontSize: TYPOGRAPHY.chartTitle.fontSize, fontWeight: TYPOGRAPHY.chartTitle.fontWeight, color: PALETTE.navy, fontFamily: TYPOGRAPHY.fontFamily, margin: 0 }}>
          Skill Recovery: True Noise vs Learned Skill
        </p>
        <div style={{ background: PALETTE.teal, color: PALETTE.white, fontSize: '1.1rem', fontWeight: 700, padding: '8px 20px', borderRadius: 20, fontFamily: TYPOGRAPHY.fontFamily }}>
          Spearman rho = 1.0000
        </div>
      </div>
      <img
        src={`${BASE}presentation-plots/quantiles_crps_recovery.png`}
        alt="Skill recovery: true noise vs learned skill showing perfect rank correlation"
        style={{ maxWidth: '100%', maxHeight: '85%', objectFit: 'contain', borderRadius: 10 }}
      />
    </div>
  );
}
