import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import SmallScreenNotice, { NOTICE_STORAGE_KEY } from '@/components/dashboard/SmallScreenNotice';
import { SMALL_SCREEN_MAX } from '@/components/platform/designTokens';

/**
 * The small-screen notice (P5) must appear below the tablet breakpoint
 * (768px), stay hidden at and above it, and remember its dismissal for the
 * session. jsdom has no `matchMedia`, so we stub it from a settable viewport
 * width and parse the `max-width` query the component subscribes to.
 */

let viewportWidth = 1280;

function installMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => {
      const m = /max-width:\s*(\d+)px/.exec(query);
      const max = m ? parseInt(m[1], 10) : Infinity;
      return {
        matches: viewportWidth <= max,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    },
  );
}

beforeEach(() => {
  viewportWidth = 1280;
  sessionStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SmallScreenNotice - appears only below the tablet breakpoint', () => {
  it('renders on a phone width (360px)', () => {
    viewportWidth = 360;
    render(<SmallScreenNotice />);
    expect(screen.getByTestId('small-screen-notice')).toBeTruthy();
  });

  it('renders just below the boundary (767px)', () => {
    viewportWidth = SMALL_SCREEN_MAX - 1;
    render(<SmallScreenNotice />);
    expect(screen.getByTestId('small-screen-notice')).toBeTruthy();
  });

  it('does not render at the boundary (768px)', () => {
    viewportWidth = SMALL_SCREEN_MAX;
    render(<SmallScreenNotice />);
    expect(screen.queryByTestId('small-screen-notice')).toBeNull();
  });

  it('does not render on a laptop width (1280px)', () => {
    viewportWidth = 1280;
    render(<SmallScreenNotice />);
    expect(screen.queryByTestId('small-screen-notice')).toBeNull();
  });
});

describe('SmallScreenNotice - dismissal persists in sessionStorage', () => {
  it('hides the notice and writes the flag when dismissed', () => {
    viewportWidth = 390;
    render(<SmallScreenNotice />);
    fireEvent.click(screen.getByTestId('small-screen-notice-dismiss'));
    expect(screen.queryByTestId('small-screen-notice')).toBeNull();
    expect(sessionStorage.getItem(NOTICE_STORAGE_KEY)).toBe('1');
  });

  it('stays hidden on a fresh mount when the session flag is already set', () => {
    viewportWidth = 390;
    sessionStorage.setItem(NOTICE_STORAGE_KEY, '1');
    render(<SmallScreenNotice />);
    expect(screen.queryByTestId('small-screen-notice')).toBeNull();
  });
});
