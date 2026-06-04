import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

/**
 * Slide 15: Strategic Robustness — properly centred layout.
 * Title centred, subtitle centred, attack table centred, shield centred below.
 */

interface AttackRow {
  attack: string;
  outcome: string;
  pass: boolean;
}

const ATTACKS: AttackRow[] = [
  { attack: 'Sybil (identical)', outcome: 'No advantage', pass: true },
  { attack: 'Sybil (diversified)', outcome: 'Small advantage (~6%)', pass: false },
  { attack: 'Arbitrage', outcome: 'No sustained profit', pass: true },
  { attack: 'Strategic Deposit', outcome: 'No advantage', pass: true },
  { attack: 'Reputation Gaming', outcome: 'Detected within ~20 rounds', pass: true },
  { attack: 'Collusion', outcome: 'Limited by individual skill gates', pass: true },
  { attack: 'Risk-Averse Hedging', outcome: 'Minimal impact on aggregate', pass: true },
];

/** Colour-coded SVG icon per attack type (22×22) */
function AttackIcon({ attack }: { attack: string }) {
  const s = 22;
  if (attack.startsWith('Sybil')) {
    // Two overlapping circles — "split person" in coral
    return (
      <svg width={s} height={s} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="11" r="6" stroke={PALETTE.coral} strokeWidth="1.8" fill={PALETTE.coral} fillOpacity={0.15} />
        <circle cx="14" cy="11" r="6" stroke={PALETTE.coral} strokeWidth="1.8" fill={PALETTE.coral} fillOpacity={0.15} />
      </svg>
    );
  }
  if (attack === 'Arbitrage') {
    // Dollar sign in a circle — purple
    return (
      <svg width={s} height={s} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="9" stroke={PALETTE.purple} strokeWidth="1.8" fill={PALETTE.purple} fillOpacity={0.1} />
        <text x="11" y="15.5" textAnchor="middle" fontSize="13" fontWeight="700" fill={PALETTE.purple} fontFamily="sans-serif">$</text>
      </svg>
    );
  }
  if (attack === 'Strategic Deposit') {
    // Coin stack — imperial
    return (
      <svg width={s} height={s} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
        <ellipse cx="11" cy="15" rx="7" ry="3" stroke={PALETTE.imperial} strokeWidth="1.6" fill={PALETTE.imperial} fillOpacity={0.12} />
        <ellipse cx="11" cy="11" rx="7" ry="3" stroke={PALETTE.imperial} strokeWidth="1.6" fill={PALETTE.imperial} fillOpacity={0.12} />
        <ellipse cx="11" cy="7" rx="7" ry="3" stroke={PALETTE.imperial} strokeWidth="1.6" fill={PALETTE.imperial} fillOpacity={0.12} />
      </svg>
    );
  }
  if (attack === 'Reputation Gaming') {
    // Mask/eye icon — teal
    return (
      <svg width={s} height={s} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
        <path d="M2 11 C5 5, 17 5, 20 11 C17 17, 5 17, 2 11Z" stroke={PALETTE.teal} strokeWidth="1.6" fill={PALETTE.teal} fillOpacity={0.1} />
        <circle cx="11" cy="11" r="3" stroke={PALETTE.teal} strokeWidth="1.6" fill={PALETTE.teal} fillOpacity={0.2} />
      </svg>
    );
  }
  if (attack === 'Collusion') {
    // Two handshake lines — slate
    return (
      <svg width={s} height={s} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
        <path d="M3 14 L8 10 L11 12 L14 10 L19 14" stroke={PALETTE.slate} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 10 L8 6 L11 8 L14 6 L19 10" stroke={PALETTE.slate} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (attack === 'Risk-Averse Hedging') {
    // Shield icon — slate
    return (
      <svg width={s} height={s} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
        <path d="M11 2 L19 6 V12 C19 16.5 15.5 19.5 11 21 C6.5 19.5 3 16.5 3 12 V6 L11 2Z" stroke={PALETTE.slate} strokeWidth="1.6" fill={PALETTE.slate} fillOpacity={0.1} />
      </svg>
    );
  }
  return null;
}

/** SVG checkmark */
function PassIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="rgba(46, 139, 139, 0.1)" stroke={PALETTE.teal} strokeWidth="2" />
      <path d="M7 12 L10.5 15.5 L17 9" stroke={PALETTE.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** SVG warning triangle */
function WarnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 L22 20 H2 Z" fill="rgba(124, 58, 237, 0.1)" stroke={PALETTE.purple} strokeWidth="2" strokeLinejoin="round" />
      <line x1="12" y1="10" x2="12" y2="14" stroke={PALETTE.purple} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill={PALETTE.purple} />
    </svg>
  );
}

export default function StrategicRobustnessSlide() {
  return (
    <SlideShell title="Strategic Robustness" subtitle="Does the mechanism resist manipulation?" refText="Chen et al., 2014" slideNumber={12}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        {/* Attack table — centred */}
        <div
          style={{
            background: PALETTE.white,
            borderRadius: 12,
            border: `1.5px solid ${PALETTE.border}`,
            padding: '28px 44px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            width: '100%',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: `2px solid ${PALETTE.border}`,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>
              Attack Type
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>
              Outcome
            </span>
          </div>

          {ATTACKS.map((row) => (
            <div
              key={row.attack}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                borderBottom: `1px solid ${PALETTE.border}`,
              }}
            >
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 600,
                  color: PALETTE.navy,
                  fontFamily: TYPOGRAPHY.fontFamily,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AttackIcon attack={row.attack} />
                {row.attack}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: PALETTE.charcoal,
                    fontFamily: TYPOGRAPHY.fontFamily,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.outcome}
                </span>
                {row.pass ? <PassIcon /> : <WarnIcon />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}
