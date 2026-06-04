import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY, CARD_STYLE } from './shared/presentationConstants';
import { FORECASTERS } from './forecasterData';

/** Type badge colour mapping */
function badgeColour(type: string): { bg: string; text: string } {
  switch (type) {
    case 'Statistical':
      return { bg: 'rgba(0, 62, 116, 0.10)', text: PALETTE.imperial };
    case 'Machine Learning':
      return { bg: 'rgba(46, 139, 139, 0.10)', text: PALETTE.teal };
    case 'Ensemble':
      return { bg: 'rgba(124, 58, 237, 0.10)', text: PALETTE.purple };
    case 'Baseline':
      return { bg: 'rgba(100, 116, 139, 0.10)', text: PALETTE.slate };
    default:
      return { bg: 'rgba(100, 116, 139, 0.10)', text: PALETTE.slate };
  }
}

/** Small 24×24 SVG icon per model type, coloured with the badge colour */
function ModelTypeIcon({ type, colour }: { type: string; colour: string }) {
  const size = 24;
  switch (type) {
    case 'Baseline':
      // Horizontal line — simple persistence
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <line x1="3" y1="12" x2="21" y2="12" stroke={colour} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'Statistical':
      // Sine wave
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M2 12 C5 6, 8 6, 10 12 S15 18, 18 12 S21 6, 22 12"
            stroke={colour}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case 'Machine Learning':
      // Neural network nodes
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          {/* connections */}
          <line x1="5" y1="7" x2="12" y2="5" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          <line x1="5" y1="7" x2="12" y2="12" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          <line x1="5" y1="17" x2="12" y2="12" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          <line x1="5" y1="17" x2="12" y2="19" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          <line x1="12" y1="5" x2="19" y2="12" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          <line x1="12" y1="12" x2="19" y2="12" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          <line x1="12" y1="19" x2="19" y2="12" stroke={colour} strokeWidth="1.3" opacity={0.5} />
          {/* nodes */}
          <circle cx="5" cy="7" r="2.5" fill={colour} />
          <circle cx="5" cy="17" r="2.5" fill={colour} />
          <circle cx="12" cy="5" r="2.5" fill={colour} />
          <circle cx="12" cy="12" r="2.5" fill={colour} />
          <circle cx="12" cy="19" r="2.5" fill={colour} />
          <circle cx="19" cy="12" r="2.5" fill={colour} />
        </svg>
      );
    case 'Ensemble':
      // Overlapping circles
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="9" cy="12" r="6" stroke={colour} strokeWidth="2" fill={colour} fillOpacity={0.12} />
          <circle cx="15" cy="12" r="6" stroke={colour} strokeWidth="2" fill={colour} fillOpacity={0.12} />
        </svg>
      );
    default:
      return null;
  }
}

/** Background tint for Elia dataset cards */
function datasetBgTint(label: string): string {
  switch (label) {
    case 'Wind':
      return 'rgba(46, 139, 139, 0.05)';   // teal 5%
    case 'Electricity':
      return 'rgba(232, 93, 74, 0.05)';     // coral 5%
    default:
      return '#FFFFFF';
  }
}

const ELIA_DATASETS = [
  {
    label: 'Wind',
    colour: PALETTE.teal,
    text: 'Elia Wind Power — 17,544 hourly observations from the Belgian grid operator',
  },
  {
    label: 'Electricity',
    colour: PALETTE.coral,
    text: 'Elia Electricity Prices — 10,000 hourly observations',
  },
];

/**
 * Slide 9 — Models, Data, and Synthetic Setup.
 *
 * Three sections:
 *  1. Compact 7-model grid (name + type icon + type badge + one-line description)
 *  2. Two Elia dataset cards with subtle colour tints
 *  3. Motivation bar with teal checkmark icon
 */
export default function ModelsDataOverviewSlide() {
  return (
    <SlideShell title="Models, Data, and Synthetic Setup" slideNumber={8}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 0,
          fontFamily: TYPOGRAPHY.fontFamily,
          minHeight: 0,
        }}
      >
        {/* ── Top: 7-model grid — flex:1 so it grows ── */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            alignContent: 'stretch',
          }}
        >
          {FORECASTERS.map((f) => {
            const badge = badgeColour(f.type);
            return (
              <div
                key={f.name}
                style={{
                  ...CARD_STYLE,
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  borderLeft: `4px solid ${badge.text}`,
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <ModelTypeIcon type={f.type} colour={badge.text} />
                  <span
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: PALETTE.navy,
                    }}
                  >
                    {f.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: badge.text,
                      background: badge.bg,
                      padding: '2px 8px',
                      borderRadius: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.type}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '1.1rem',
                    color: PALETTE.charcoal,
                    lineHeight: 1.4,
                  }}
                >
                  {f.description}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Middle: Elia dataset cards with colour tints ── */}
        <div style={{ display: 'flex', gap: 18, marginTop: 28 }}>
          {ELIA_DATASETS.map((ds) => (
            <div
              key={ds.label}
              style={{
                ...CARD_STYLE,
                flex: 1,
                padding: '20px 24px',
                borderLeft: `4px solid ${ds.colour}`,
                background: datasetBgTint(ds.label),
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: ds.colour,
                  whiteSpace: 'nowrap',
                }}
              >
                {ds.label}
              </span>
              <span
                style={{
                  fontSize: '1.1rem',
                  color: PALETTE.charcoal,
                  lineHeight: 1.4,
                }}
              >
                {ds.text}
              </span>
            </div>
          ))}
        </div>

        {/* ── Bottom: motivation bar with teal checkmark icon ── */}
        <div
          style={{
            marginTop: 20,
            background: 'rgba(46, 139, 139, 0.08)',
            borderLeft: `5px solid ${PALETTE.teal}`,
            padding: '18px 28px',
            borderRadius: '0 12px 12px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Teal checkmark icon */}
          <svg width={28} height={28} viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="14" cy="14" r="13" fill={PALETTE.teal} fillOpacity={0.15} stroke={PALETTE.teal} strokeWidth="1.5" />
            <path d="M8 14.5 L12 18.5 L20 10" stroke={PALETTE.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span
            style={{
              fontSize: '1.2rem',
              fontWeight: 600,
              color: PALETTE.navy,
              lineHeight: 1.5,
            }}
          >
            Synthetic cases validate correctness with known ground truth → Real data tests
            practical performance
          </span>
        </div>
      </div>
    </SlideShell>
  );
}
