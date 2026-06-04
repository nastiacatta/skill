import { PALETTE, TYPOGRAPHY, DARK_GRADIENT } from './shared/presentationConstants';

const BASE = import.meta.env.BASE_URL;

/**
 * Slide 1: Title slide — dark, centred layout.
 *
 * Displays presenter name, project title, institution, and supervisor
 * acknowledgements. Includes a subtle abstract SVG showing three
 * individual forecast arrows converging into one aggregated arrow
 * (prediction market concept).
 *
 * No technical content, research questions, or bullet points.
 */
export default function TitleSlide() {
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
        padding: '64px 72px',
        backgroundImage: `linear-gradient(180deg, rgba(7, 15, 35, 0.78) 0%, rgba(7, 15, 35, 0.82) 100%), url(${BASE}presentation-plots/title_background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: DARK_GRADIENT,
        fontFamily: TYPOGRAPHY.fontFamily,
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${PALETTE.imperial}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Presenter name */}
      <p
        style={{
          fontSize: '1.3rem',
          fontWeight: 600,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: PALETTE.teal,
          marginBottom: 28,
        }}
      >
        Anastasia Cattaneo
      </p>

      {/* Project title */}
      <h1
        style={{
          fontSize: '4.8rem',
          fontWeight: TYPOGRAPHY.heading.fontWeight,
          color: PALETTE.white,
          lineHeight: 1.15,
          marginBottom: 20,
          maxWidth: 900,
          letterSpacing: '-0.02em',
        }}
      >
        Self-Financed Prediction Markets{'\n'}with Skill-Weighted Stakes
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '1.4rem',
          color: PALETTE.darkText,
          lineHeight: 1.6,
          maxWidth: 650,
          marginBottom: 36,
          opacity: 0.85,
        }}
      >
        A weighted-score wagering mechanism with an online skill-estimation layer
      </p>

      {/* Institution + Supervisors */}
      <p
        style={{
          fontSize: '1.2rem',
          color: PALETTE.darkText,
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        Imperial College London
      </p>

      <p
        style={{
          fontSize: '1.15rem',
          color: PALETTE.teal,
          fontWeight: 600,
          lineHeight: 1.6,
        }}
      >
        Supervisors: Pierre Pinson · Michael Vitali
      </p>
    </div>
  );
}
