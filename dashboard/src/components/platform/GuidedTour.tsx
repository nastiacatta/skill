/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/platform/ui';
import { TYPE, SPACE, RADIUS } from '@/components/platform/designTokens';
import { TOUR_STEPS, TOUR_LENGTH } from '@/lib/platform/guidedTour';

/**
 * The guided tour: a thin presenter layer over the real routes. It threads a
 * viewer through the project's contribution as an ordered sequence
 * (`TOUR_STEPS`, in the thesis draft's narrative order), each step pinned to
 * the live dashboard surface that evidences it. Starting the tour moves the
 * viewer to the first step's route and pins a bottom rail with the step copy,
 * a progress indicator, and Back / Next / Exit. The rail never replaces a
 * view: every route is still reachable on its own.
 *
 * State lives in a context provider so the entry points (landing button, top
 * bar launcher) and the overlay share one source of truth. The active step
 * drives the router, and arriving on a step's route (by any means) keeps the
 * rail in sync.
 */

interface TourState {
  /** Whether the tour rail is showing. */
  active: boolean;
  /** Zero-based index of the active step. */
  index: number;
  /** Begin the tour at a given step (default 0) and navigate to its route. */
  start: (at?: number) => void;
  /** Leave the tour (the current view stays put). */
  exit: () => void;
  /** Advance one step, or finish if on the last. */
  next: () => void;
  /** Go back one step (no-op on the first). */
  back: () => void;
}

const TourContext = createContext<TourState | null>(null);

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  // The fallback pointer, used only when the live route does not match a tour
  // step (the viewer wandered off the tour's surfaces). When the route does
  // match a step, that route is the source of truth, so navigating by any
  // means (rail link, sidebar, cross-link) keeps the active step aligned with
  // no effect-driven state sync.
  const [pointer, setPointer] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const routeIndex = TOUR_STEPS.findIndex((s) => s.to === location.pathname);
  const index = routeIndex !== -1 ? routeIndex : pointer;

  const start = useCallback(
    (at = 0) => {
      const clamped = Math.max(0, Math.min(TOUR_LENGTH - 1, at));
      setPointer(clamped);
      setActive(true);
      navigate(TOUR_STEPS[clamped].to);
    },
    [navigate],
  );

  const exit = useCallback(() => setActive(false), []);

  const next = useCallback(() => {
    if (index >= TOUR_LENGTH - 1) {
      setActive(false);
      return;
    }
    const ni = index + 1;
    setPointer(ni);
    navigate(TOUR_STEPS[ni].to);
  }, [index, navigate]);

  const back = useCallback(() => {
    if (index <= 0) return;
    const pi = index - 1;
    setPointer(pi);
    navigate(TOUR_STEPS[pi].to);
  }, [index, navigate]);

  const value = useMemo<TourState>(
    () => ({ active, index, start, exit, next, back }),
    [active, index, start, exit, next, back],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useGuidedTour(): TourState {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useGuidedTour must be used within GuidedTourProvider');
  return ctx;
}

/**
 * Soft read for the entry-point buttons. The launcher and the landing CTA
 * render inside the shell (which always provides the context) but are also
 * mounted by isolated component tests with no provider. Outside a provider
 * they fall back to a no-op so the surrounding view still renders.
 */
function useOptionalTour(): TourState | null {
  return useContext(TourContext);
}

/* ------------------------------------------------------------------ */
/*  Entry points                                                       */
/* ------------------------------------------------------------------ */

const CompassGlyph = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M15.5 8.5L13.5 13.5L8.5 15.5L10.5 10.5L15.5 8.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** A primary call to action that begins the tour. Used on the landing. */
export function StartTourButton({
  size = 'lg',
  variant = 'secondary',
  label = 'Start the guided tour',
}: {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  label?: string;
}) {
  const tour = useOptionalTour();
  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => tour?.start(0)}
      iconLeft={<CompassGlyph />}
      data-testid="tour-start"
    >
      {label}
    </Button>
  );
}

/** A compact launcher for the top bar. */
export function TourLauncher() {
  const tour = useOptionalTour();
  if (!tour || tour.active) return null;
  const { start } = tour;
  return (
    <button
      type="button"
      onClick={() => start(0)}
      data-testid="tour-launcher"
      title="Start the guided tour"
      aria-label="Start the guided tour"
      className="shell-tour-launcher"
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
        cursor: 'pointer',
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
      <CompassGlyph />
      <span className="tour-launcher-text">Guided tour</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  The rail                                                           */
/* ------------------------------------------------------------------ */

/**
 * The pinned presenter rail. Renders only when the tour is active. Shows the
 * step number out of the total, the step title and plain-English copy, an
 * explicit link to the step's target view, and Back / Next / Exit. Keyboard:
 * ArrowRight / ArrowLeft move the step, Escape exits, and focus moves to the
 * rail when it opens so the controls are reachable without a mouse.
 */
export function GuidedTourRail() {
  const { active, index, next, back, exit } = useGuidedTour();
  const railRef = useRef<HTMLDivElement>(null);
  // Track step direction so the cross-fade slides forward (Next) or back (Back).
  const prevIndexRef = useRef(index);
  const direction = index >= prevIndexRef.current ? 1 : -1;
  useEffect(() => {
    prevIndexRef.current = index;
  }, [index]);

  // Move focus to the rail when it opens, so keyboard users land on the
  // controls. The open animation is a CSS keyframe (neutralised under
  // reduce-motion), so no animation state lives in React.
  useEffect(() => {
    if (active) railRef.current?.focus();
  }, [active]);

  // Global keyboard control while the tour is open.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, back, exit]);

  if (!active) return null;

  const step = TOUR_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === TOUR_LENGTH - 1;

  return (
    <div
      ref={railRef}
      role="region"
      aria-label={`Guided tour, step ${index + 1} of ${TOUR_LENGTH}`}
      tabIndex={-1}
      data-testid="guided-tour-rail"
      className="guided-tour-rail no-print"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: SPACE[5],
        transform: 'translateX(-50%)',
        animation: 'guided-tour-rail-in 200ms ease both',
        zIndex: 50,
        width: 'min(720px, calc(100vw - 32px))',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--card)',
        border: '1px solid var(--border-strong)',
        borderRadius: RADIUS.lg,
        boxShadow: 'var(--shadow-lg)',
        padding: `${SPACE[4]}px ${SPACE[5]}px`,
        outline: 'none',
      }}
    >
      {/* Progress: step N of total, plus a segmented bar. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[3],
          marginBottom: SPACE[2],
        }}
      >
        <span
          data-testid="tour-progress"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.label.size,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--teal-deep)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Step {index + 1} of {TOUR_LENGTH}
        </span>
        <button
          type="button"
          onClick={exit}
          data-testid="tour-exit"
          aria-label="Exit the guided tour"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 36,
            padding: `0 ${SPACE[2]}px`,
            border: 'none',
            background: 'transparent',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.caption.size,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
        >
          Exit
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ol
        aria-hidden="true"
        style={{
          display: 'flex',
          gap: 4,
          listStyle: 'none',
          margin: `0 0 ${SPACE[3]}px`,
          padding: 0,
        }}
      >
        {TOUR_STEPS.map((s, i) => (
          <li
            key={s.id}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: 'var(--border)',
              overflow: 'hidden',
            }}
          >
            {/* The fill grows from the left as the round advances, so progress
                reads as motion rather than a step change. A CSS transform
                transition (240ms ease-in-out) matches the previous reorder
                token; the reduce-motion guard in index.css neutralises it. */}
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                height: '100%',
                borderRadius: 999,
                background: 'var(--teal)',
                transformOrigin: 'left center',
                transform: `scaleX(${i <= index ? 1 : 0})`,
                transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </li>
        ))}
      </ol>

      {/* A keyed block: changing the step remounts it (via `key`), so the new
          copy fades and slides in with a clear forward / back direction. The
          slide origin is driven by a CSS custom property so Next slides in from
          the right and Back from the left, matching the prior framer-motion
          behaviour (opacity 0 to 1, 24px slide, 240ms ease-out). The new
          content mounts synchronously, so the rail always shows exactly the
          active step. The reduce-motion guard in index.css collapses it. */}
      <div
        key={step.id}
        className="guided-tour-step-in"
        style={{ ['--tour-step-x' as string]: `${direction * 24}px` }}
      >
        <h2
          data-testid="tour-title"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: TYPE.h3.size,
            lineHeight: TYPE.h3.lineHeight,
            fontWeight: TYPE.h3.weight,
            color: 'var(--ink)',
            margin: `0 0 ${SPACE[2]}px`,
          }}
        >
          {step.title}
        </h2>
        <p
          aria-live="polite"
          data-testid="tour-blurb"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.body.size,
            lineHeight: TYPE.body.lineHeight,
            color: 'var(--ink-soft)',
            margin: 0,
          }}
        >
          {step.blurb}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[3],
          flexWrap: 'wrap',
          marginTop: SPACE[4],
          paddingTop: SPACE[4],
          borderTop: '1px solid var(--border)',
        }}
      >
        <a
          href={`#${step.to}`}
          data-testid="tour-step-link"
          data-to={step.to}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.caption.size,
            fontWeight: 600,
            color: 'var(--navy)',
            textDecoration: 'none',
          }}
        >
          {step.linkLabel} &rarr;
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
          <Button
            size="md"
            variant="ghost"
            onClick={back}
            disabled={isFirst}
            data-testid="tour-back"
          >
            Back
          </Button>
          <Button size="md" variant="primary" onClick={next} data-testid="tour-next">
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes guided-tour-rail-in {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes guided-tour-step-in {
          from { opacity: 0; transform: translateX(var(--tour-step-x, 0)); }
          to { opacity: 1; transform: translateX(0); }
        }
        .guided-tour-step-in {
          animation: guided-tour-step-in 240ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .guided-tour-rail,
          .guided-tour-step-in { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
