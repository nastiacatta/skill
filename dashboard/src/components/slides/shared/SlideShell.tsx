import { PALETTE, TYPOGRAPHY, DARK_GRADIENT, getSectionForSlide, SECTION_BAR_HEIGHT, MAIN_DECK_SLIDE_COUNT, SLIDE_PAGE_PADDING } from './presentationConstants';

export interface SlideShellProps {
  title: string;
  subtitle?: string;
  dark?: boolean;
  refText?: string;
  highlight?: string;
  slideNumber?: number;
  totalSlides?: number;
  children: React.ReactNode;
}

/** Section bar at the top of each slide — 6px tall, full width */
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

/** Section indicator label — small caps at top */
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
        fontFamily: TYPOGRAPHY.fontFamily,
        opacity: 0.85,
      }}
    >
      {section.label}
    </div>
  );
}

/** Slide number indicator — top-right corner */
function SlideNumber({ slideNumber, totalSlides, dark }: { slideNumber?: number; totalSlides?: number; dark?: boolean }) {
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
        fontFamily: TYPOGRAPHY.fontFamily,
        zIndex: 10,
        padding: '6px 14px',
        borderRadius: 999,
        background: dark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.92)',
        border: dark ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${PALETTE.border}`,
        boxShadow: dark ? 'none' : '0 2px 10px rgba(27, 42, 74, 0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {slideNumber} / {totalSlides ?? MAIN_DECK_SLIDE_COUNT}
    </div>
  );
}

/** Accent bar under slide titles */
function AccentBar({ dark }: { dark?: boolean }) {
  return (
    <div
      style={{
        width: 64,
        height: 3,
        background: dark ? PALETTE.border : PALETTE.teal,
        borderRadius: 2,
        marginTop: 12,
        opacity: dark ? 0.6 : 0.9,
      }}
    />
  );
}

/** Footer */
function SlideFooter({ refText, dark }: { refText?: string; dark?: boolean }) {
  return (
    <div
      style={{
        flexShrink: 0,
        paddingTop: 18,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: '0.875rem',
          color: dark ? PALETTE.darkText : PALETTE.slate,
          textAlign: 'left',
        }}
      >
        Anastasia Cattaneo — Imperial College London
      </span>
      {refText && (
        <span
          style={{
            fontSize: '0.78rem',
            color: dark ? PALETTE.darkText : PALETTE.slate,
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

/** Highlight bar with left border accent */
function HighlightBar({ text }: { text: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        marginTop: 20,
        background: 'rgba(46, 139, 139, 0.07)',
        borderLeft: `5px solid ${PALETTE.teal}`,
        color: PALETTE.navy,
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

/**
 * SlideShell — common wrapper for custom slide components.
 */
export default function SlideShell({ title, subtitle, dark, refText, highlight, slideNumber, totalSlides, children }: SlideShellProps) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        ...SLIDE_PAGE_PADDING,
        background: dark ? DARK_GRADIENT : PALETTE.offWhite,
        fontFamily: TYPOGRAPHY.fontFamily,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <SectionBar slideNumber={slideNumber} />
      <SlideNumber slideNumber={slideNumber} totalSlides={totalSlides} dark={dark} />

      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: 26 }}>
        <SectionLabel slideNumber={slideNumber} dark={dark} />
        <h2
          style={{
            fontSize: TYPOGRAPHY.heading.fontSize,
            fontWeight: TYPOGRAPHY.heading.fontWeight,
            color: dark ? PALETTE.white : PALETTE.navy,
            lineHeight: TYPOGRAPHY.heading.lineHeight,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontSize: '1.25rem',
              color: dark ? PALETTE.darkText : PALETTE.slate,
              marginTop: 10,
              lineHeight: 1.5,
              maxWidth: 960,
              fontWeight: 400,
            }}
          >
            {subtitle}
          </p>
        )}
        <AccentBar dark={dark} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </div>

      {highlight && <HighlightBar text={highlight} />}
      <SlideFooter refText={refText} dark={dark} />
    </div>
  );
}
