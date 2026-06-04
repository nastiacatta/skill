import { useLocation } from 'react-router-dom';
import { LAYOUT, RADIUS, TYPE, SPACE, DURATION, EASING } from '@/components/platform/designTokens';
import { TourLauncher } from '@/components/platform/GuidedTour';
import { ZONES, ZONE_ORDER, zoneForPath, crossLinkForPath, type Zone } from './navModel';

/**
 * The unified app shell top bar. Carries the product wordmark, the two-face
 * segmented control ([ Try the platform | Read the research ]), and the
 * contextual cross-link into the other zone. 64px tall, sticky.
 *
 * The segmented control swaps the rail and lands on the chosen face's home,
 * so a visitor moves between trying the platform and reading the research in
 * one click. Navigation uses hash anchors so the bar is router-independent
 * for tests and never depends on a wrapping <Link>.
 */

const ExternalArrow = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M4.5 8H11.5M11.5 8L8.5 5M11.5 8L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function TopBar() {
  const location = useLocation();
  const zone = zoneForPath(location.pathname);
  const cross = crossLinkForPath(location.pathname);

  return (
    <header
      className="shell-topbar no-print"
      style={{
        height: LAYOUT.topBarHeight,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[6],
        padding: `0 ${SPACE[6]}px`,
        background: 'var(--paper)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Wordmark */}
      <a
        href="#/platform"
        className="shell-wordmark"
        style={{
          display: 'flex',
          flexDirection: 'column',
          textDecoration: 'none',
          flexShrink: 0,
          minWidth: 0,
        }}
        aria-label="Skill and Stake home"
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.1,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          Skill &amp; Stake
        </span>
        <span
          className="shell-wordmark-sub"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.label.size,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          A prediction market
        </span>
      </a>

      {/* Two-face segmented control, centred */}
      <nav
        aria-label="Choose a zone"
        className="shell-segment"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[1],
          margin: '0 auto',
          padding: SPACE[1],
          background: 'var(--cream)',
          border: '1px solid var(--border)',
          borderRadius: RADIUS.pill,
        }}
      >
        {ZONE_ORDER.map((z) => (
          <ZoneFace key={z} zone={z} active={z === zone} />
        ))}
      </nav>

      {/* Start the guided tour */}
      <TourLauncher />

      {/* Contextual cross-link into the other zone */}
      <a
        href={`#${cross.to}`}
        className="shell-crosslink"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACE[2],
          flexShrink: 0,
          minHeight: 44,
          padding: `0 ${SPACE[4]}px`,
          borderRadius: RADIUS.pill,
          border: '1px solid var(--border-strong)',
          background: 'var(--paper)',
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.caption.size,
          fontWeight: 600,
          textDecoration: 'none',
          transition: `background ${DURATION.instant}ms ${EASING.standard}, color ${DURATION.instant}ms ${EASING.standard}, border-color ${DURATION.instant}ms ${EASING.standard}`,
        }}
        onMouseOver={(e) => {
          const el = e.currentTarget;
          el.style.background = 'var(--cream)';
          el.style.color = 'var(--ink)';
          el.style.borderColor = 'var(--navy)';
        }}
        onMouseOut={(e) => {
          const el = e.currentTarget;
          el.style.background = 'var(--paper)';
          el.style.color = 'var(--ink-muted)';
          el.style.borderColor = 'var(--border-strong)';
        }}
      >
        <span className="shell-crosslink-text">{cross.label}</span>
        <ExternalArrow />
      </a>
    </header>
  );
}

function ZoneFace({ zone, active }: { zone: Zone; active: boolean }) {
  const def = ZONES[zone];
  return (
    <a
      href={`#${def.home}`}
      aria-current={active ? 'page' : undefined}
      title={def.faceHint}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
        padding: `0 ${SPACE[5]}px`,
        borderRadius: RADIUS.pill,
        fontFamily: 'var(--font-sans)',
        fontSize: 16,
        fontWeight: 700,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        background: active ? 'var(--navy)' : 'transparent',
        color: active ? '#fbf9f4' : 'var(--ink-soft)',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        transition: `background ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}`,
      }}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--ink)';
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--ink-soft)';
      }}
    >
      {def.faceLabel}
    </a>
  );
}
