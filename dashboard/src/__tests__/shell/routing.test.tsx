import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import App from '@/App';

/**
 * The store providers fetch artefact JSON on mount; jsdom has no network, so
 * we stub fetch to a benign empty response. The shell routing under test does
 * not depend on the artefacts.
 */
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '{}',
  })) as unknown as typeof fetch,
);

/**
 * Shell routing integration. Mounts the real App (HashRouter) and
 * drives it through the hash to confirm canonical routes resolve and every
 * legacy redirect lands on its canonical target. Pages are lazy, so we wait
 * for the title (set on navigation) rather than page content, which keeps
 * the test fast and independent of any one page's internals.
 */

function setHash(path: string) {
  window.location.hash = `#${path}`;
}

afterEach(cleanup);

beforeEach(() => {
  window.location.hash = '';
});

describe('shell - canonical routes set the page title', () => {
  const cases: Array<[string, string]> = [
    ['/platform', 'Platform · Skill × Stake'],
    ['/platform/market', 'Market · Skill × Stake'],
    ['/research', 'Research · Skill × Stake'],
    ['/evidence', 'Evidence · Skill × Stake'],
    ['/explainer', 'Explainer · Skill × Stake'],
    ['/audit', 'Audit · Skill × Stake'],
    ['/appendix/diagnostics', 'Appendix · Diagnostics · Skill × Stake'],
  ];

  for (const [path, title] of cases) {
    it(`${path} → "${title}"`, async () => {
      setHash(path);
      render(<App />);
      await waitFor(() => expect(document.title).toBe(title));
    });
  }
});

describe('shell - legacy redirects resolve (no 404)', () => {
  const redirects: Array<[string, string]> = [
    ['/', 'Platform · Skill × Stake'],
    ['/story', 'Platform · Skill × Stake'],
    ['/about', 'Research · Skill × Stake'],
    ['/overview', 'Research · Skill × Stake'],
    ['/results', 'Evidence · Skill × Stake'],
    ['/comparison', 'Evidence · Skill × Stake'],
    ['/behaviour', 'Robustness · Skill × Stake'],
    ['/validation', 'Robustness · Skill × Stake'],
    ['/explorer', 'Explainer · Skill × Stake'],
    ['/mechanism', 'Explainer · Skill × Stake'],
    ['/walkthrough', 'Explainer · Skill × Stake'],
    ['/pipeline', 'Explainer · Skill × Stake'],
    ['/mechanism-explorer', 'Explainer · Skill × Stake'],
    ['/lab', 'Appendix · Lab · Skill × Stake'],
    ['/experiments', 'Appendix · Experiments · Skill × Stake'],
    ['/platform/me', 'My account · Skill × Stake'],
    ['/totally-unknown-route', 'Platform · Skill × Stake'],
  ];

  for (const [from, title] of redirects) {
    it(`${from} redirects to ${title}`, async () => {
      setHash(from);
      render(<App />);
      await waitFor(() => expect(document.title).toBe(title));
    });
  }
});

describe('shell - chrome is present in both zones', () => {
  it('renders the two-face segmented control', async () => {
    setHash('/platform');
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: /choose a zone/i })).toBeDefined(),
    );
    expect(screen.getAllByText('Try the platform').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Read the research').length).toBeGreaterThan(0);
  });
});
