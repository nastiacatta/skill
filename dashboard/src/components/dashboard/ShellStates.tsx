import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SPACE, TYPE } from '@/components/platform/designTokens';

/**
 * One consistent loading and error surface for every route in both zones.
 * The lazy boundaries (platform and research) share `RouteFallback`; the
 * `RouteErrorBoundary` catches a failed render or chunk load and offers a
 * calm recovery, so neither zone can show a blank screen.
 */

/** Calm, role-status loading line shown while a lazy route's chunk loads. */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: `${SPACE[16]}px ${SPACE[10]}px`,
        fontFamily: 'var(--font-sans)',
        fontSize: TYPE.lead.size,
        color: 'var(--ink-soft)',
      }}
    >
      Loading…
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Reset key: when it changes, the boundary clears its error (used on route change). */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console for debugging; the UI stays calm.
    console.error('Route render failed:', error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: `${SPACE[16]}px ${SPACE[10]}px`,
            maxWidth: 640,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: TYPE.h2.size,
              fontWeight: TYPE.h2.weight,
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            This view could not load.
          </h2>
          <p
            style={{
              fontSize: TYPE.body.size,
              lineHeight: TYPE.body.lineHeight,
              color: 'var(--ink-soft)',
              marginTop: SPACE[4],
            }}
          >
            Something went wrong rendering this page. Try reloading, or pick
            another view from the navigation.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: SPACE[6],
              minHeight: 44,
              padding: `0 ${SPACE[5]}px`,
              borderRadius: 6,
              border: '1px solid var(--navy)',
              background: 'var(--navy)',
              color: '#fbf9f4',
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
