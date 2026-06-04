import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY, CARD_STYLE } from './shared/presentationConstants';

/**
 * Slide 11: Mechanism Guarantees — table with pass indicators (SVG checkmarks, no emojis).
 * 3-column layout: Status | Property | What it means.
 * "Result" column removed — redundant with "What it means".
 */

interface GuaranteeRow {
  property: string;
  meaning: string;
  pass: boolean;
}

const GUARANTEES: GuaranteeRow[] = [
  {
    property: 'Budget gap',
    meaning: 'Self-financed — no external subsidy needed',
    pass: true,
  },
  {
    property: 'Mean profit',
    meaning: 'Zero-sum — no money created or destroyed',
    pass: true,
  },
  {
    property: 'Sybil ratio',
    meaning: 'No advantage from splitting',
    pass: true,
  },
  {
    property: 'Noise-skill corr.',
    meaning: 'Skilled forecasters reliably rewarded',
    pass: true,
  },
];

/** SVG checkmark icon */
function CheckIcon({ pass }: { pass: boolean }) {
  if (pass) {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" fill="rgba(46, 139, 139, 0.1)" stroke={PALETTE.teal} strokeWidth="2" />
        <path d="M9 14 L12.5 17.5 L19 11" stroke={PALETTE.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" fill="rgba(232, 93, 74, 0.1)" stroke={PALETTE.coral} strokeWidth="2" />
      <path d="M10 10 L18 18 M18 10 L10 18" stroke={PALETTE.coral} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function CorrectnessSlide() {
  return (
    <SlideShell title="Mechanism Guarantees" slideNumber={11}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        <p
          style={{
            fontSize: '1.4rem',
            color: PALETTE.slate,
            fontFamily: TYPOGRAPHY.fontFamily,
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Verified to machine precision across all properties
        </p>

        <div
          style={{
            ...CARD_STYLE,
            width: '100%',
            padding: '38px 48px',
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 170px 1fr',
              gap: 16,
              paddingBottom: 14,
              borderBottom: `2px solid ${PALETTE.border}`,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: '1.06rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily, textAlign: 'center' }}>
              Status
            </span>
            <span style={{ fontSize: '1.06rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>
              Property
            </span>
            <span style={{ fontSize: '1.06rem', fontWeight: 700, color: PALETTE.slate, fontFamily: TYPOGRAPHY.fontFamily }}>
              What it means
            </span>
          </div>

          {GUARANTEES.map((row, i) => (
            <div
              key={row.property}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 170px 1fr',
                gap: 16,
                alignItems: 'center',
                padding: '18px 0 18px 0',
                borderBottom: i < GUARANTEES.length - 1 ? `1px solid ${PALETTE.border}` : 'none',
                borderLeft: row.pass ? `4px solid ${PALETTE.teal}` : '4px solid transparent',
                paddingLeft: 12,
                borderRadius: '4px 0 0 4px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <CheckIcon pass={row.pass} />
              </div>
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  color: PALETTE.navy,
                  fontFamily: TYPOGRAPHY.fontFamily,
                }}
              >
                {row.property}
              </span>
              <span
                style={{
                  fontSize: '1.2rem',
                  color: PALETTE.teal,
                  fontWeight: 600,
                  fontFamily: TYPOGRAPHY.fontFamily,
                }}
              >
                {row.meaning}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}
