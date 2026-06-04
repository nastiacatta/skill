import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import {
  GuidedTourProvider,
  GuidedTourRail,
  StartTourButton,
  TourLauncher,
} from '@/components/platform/GuidedTour';
import { TOUR_STEPS, TOUR_LENGTH } from '@/lib/platform/guidedTour';

/**
 * The guided tour (T1). It must:
 *  - present its ordered steps in the thesis draft's narrative order,
 *  - move the active step with Next / Back,
 *  - expose a link to each step's target route,
 *  - exit at any time,
 *  - carry no em-dash in any copy (style rule),
 *  - and name only currency-verified numbers (no stale-script content).
 */

afterEach(cleanup);

/** A probe that records the current route so we can assert deep-linking. */
function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location">{loc.pathname}</span>;
}

function renderTour(initial = '/platform') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <GuidedTourProvider>
        <TourLauncher />
        <StartTourButton />
        <GuidedTourRail />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </GuidedTourProvider>
    </MemoryRouter>,
  );
}

describe('guided tour — content', () => {
  it('has its steps in the thesis draft narrative order, each with a route and copy', () => {
    expect(TOUR_LENGTH).toBe(TOUR_STEPS.length);
    expect(TOUR_LENGTH).toBeGreaterThanOrEqual(6);
    const ids = TOUR_STEPS.map((s) => s.id);
    // Gap / motivation first, contribution before the round, evidence before
    // the attacks, conclusion last (the draft's arc).
    expect(ids.indexOf('gap')).toBe(0);
    expect(ids.indexOf('contribution')).toBeLessThan(ids.indexOf('round'));
    expect(ids.indexOf('evidence')).toBeLessThan(ids.indexOf('attacks'));
    expect(ids.indexOf('conclusion')).toBe(TOUR_LENGTH - 1);
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.to.startsWith('/')).toBe(true);
      expect(s.draftSource.length).toBeGreaterThan(0);
    }
  });

  it('names only currency-verified numbers and no banned framing', () => {
    const copy = TOUR_STEPS.map((s) => `${s.title} ${s.blurb}`).join(' ');
    // Verified wind headline and round count (delta_since_1055 C1, C4).
    expect(copy).toContain('7.1%');
    expect(copy).toContain('17,344');
    // Verified insider profit (robustness C22) and the operational gap (C24).
    expect(copy).toContain('57');
    expect(copy).toContain('17.0%');
    // The electricity step frames the null as predicted, never a failure
    // (do-not-claim 2): it uses the draft's own "not a failure" wording.
    const electricity = TOUR_STEPS.find((s) => s.id === 'evidence');
    expect(electricity?.blurb.toLowerCase()).toContain('not a failure');
    // Never the "the mechanism fails / failed / is failing" framing.
    expect(copy.toLowerCase()).not.toMatch(/mechanism fail|fails|failed|failing/);
    // No sybil-proof claim (do-not-claim 3).
    expect(copy.toLowerCase()).not.toContain('sybil-proof');
    // No live real-data headline framing on the synthetic market step.
    const market = TOUR_STEPS.find((s) => s.id === 'market');
    expect(market?.blurb.toLowerCase()).toContain('synthetic');
  });

  it('contains no em-dash, semicolon, or hyphen-surrogate in any tour copy', () => {
    for (const s of TOUR_STEPS) {
      for (const field of [s.title, s.blurb, s.linkLabel]) {
        expect(field).not.toContain('—');
        expect(field).not.toContain('–');
        expect(field).not.toContain('---');
        expect(field).not.toContain(';');
      }
    }
  });
});

describe('guided tour — navigation', () => {
  it('is hidden until started, then shows step 1 and deep-links its route', () => {
    renderTour('/research');
    expect(screen.queryByTestId('guided-tour-rail')).toBeNull();

    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });

    expect(screen.getByTestId('guided-tour-rail')).toBeDefined();
    expect(screen.getByTestId('tour-progress').textContent).toBe(`Step 1 of ${TOUR_LENGTH}`);
    expect(screen.getByTestId('tour-title').textContent).toBe(TOUR_STEPS[0].title);
    // Starting deep-links to the first step's route.
    expect(screen.getByTestId('location').textContent).toBe(TOUR_STEPS[0].to);
  });

  it('moves the active step with Next and Back, and deep-links each route', () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });

    act(() => {
      fireEvent.click(screen.getByTestId('tour-next'));
    });
    expect(screen.getByTestId('tour-progress').textContent).toBe(`Step 2 of ${TOUR_LENGTH}`);
    expect(screen.getByTestId('tour-title').textContent).toBe(TOUR_STEPS[1].title);
    expect(screen.getByTestId('location').textContent).toBe(TOUR_STEPS[1].to);

    act(() => {
      fireEvent.click(screen.getByTestId('tour-back'));
    });
    expect(screen.getByTestId('tour-progress').textContent).toBe(`Step 1 of ${TOUR_LENGTH}`);
    expect(screen.getByTestId('location').textContent).toBe(TOUR_STEPS[0].to);
  });

  it('exposes a link to the current step target route', () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });
    const link = screen.getByTestId('tour-step-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`#${TOUR_STEPS[0].to}`);
    expect(link.getAttribute('data-to')).toBe(TOUR_STEPS[0].to);

    act(() => {
      fireEvent.click(screen.getByTestId('tour-next'));
    });
    const link2 = screen.getByTestId('tour-step-link') as HTMLAnchorElement;
    expect(link2.getAttribute('href')).toBe(`#${TOUR_STEPS[1].to}`);
  });

  it('Back is disabled on the first step and Next finishes on the last', () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });
    expect((screen.getByTestId('tour-back') as HTMLButtonElement).disabled).toBe(true);

    // Walk to the last step.
    for (let i = 0; i < TOUR_LENGTH - 1; i++) {
      act(() => {
        fireEvent.click(screen.getByTestId('tour-next'));
      });
    }
    expect(screen.getByTestId('tour-progress').textContent).toBe(`Step ${TOUR_LENGTH} of ${TOUR_LENGTH}`);
    expect(screen.getByTestId('tour-next').textContent).toBe('Finish');

    // Finish closes the tour.
    act(() => {
      fireEvent.click(screen.getByTestId('tour-next'));
    });
    expect(screen.queryByTestId('guided-tour-rail')).toBeNull();
  });

  it('exits via the Exit control and via the Escape key', () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('tour-exit'));
    });
    expect(screen.queryByTestId('guided-tour-rail')).toBeNull();

    // Re-open, then exit with Escape.
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByTestId('guided-tour-rail')).toBeNull();
  });

  it('moves the active step with the arrow keys', () => {
    renderTour();
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(screen.getByTestId('tour-progress').textContent).toBe(`Step 2 of ${TOUR_LENGTH}`);
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(screen.getByTestId('tour-progress').textContent).toBe(`Step 1 of ${TOUR_LENGTH}`);
  });

  it('hides the top-bar launcher while the tour is running', () => {
    renderTour();
    expect(screen.getByTestId('tour-launcher')).toBeDefined();
    act(() => {
      fireEvent.click(screen.getByTestId('tour-start'));
    });
    expect(screen.queryByTestId('tour-launcher')).toBeNull();
  });
});

describe('guided tour — every step pins to a real app route', () => {
  // Routes registered in App.tsx (the canonical set the tour may link to).
  const APP_ROUTES = new Set([
    '/platform',
    '/platform/forecast',
    '/platform/market',
    '/platform/stress',
    '/platform/account',
    '/platform/leaderboard',
    '/platform/operator',
    '/research',
    '/evidence',
    '/robustness',
    '/explainer',
    '/audit',
    '/notes',
    '/appendix',
  ]);

  it('targets only registered routes', () => {
    for (const s of TOUR_STEPS) {
      expect(APP_ROUTES.has(s.to)).toBe(true);
    }
  });
});
