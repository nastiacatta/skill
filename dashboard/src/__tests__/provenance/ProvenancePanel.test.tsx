/**
 * Render test for the dev-only provenance panel.
 *
 * Confirms the panel renders the registry as a table with the diagnostics
 * banner, the column headers, and a row per claim. Artefact fetches are mocked
 * from the real files on disk so the OK/DRIFT verdicts are exercised. Under
 * vitest `import.meta.env.DEV` is true, so the panel renders rather than
 * showing its production gate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ProvenancePanel from '@/pages/ProvenancePanel';
import { PROVENANCE_CLAIMS } from '@/lib/provenance';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

beforeEach(() => {
  // Serve committed artefacts to the panel's fetch, mirroring the dev server.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      // URL is `${BASE_URL}<file>`; strip the base to get the public-relative path.
      const file = url.replace(import.meta.env.BASE_URL, '');
      const text = await readFile(path.join(PUBLIC_DIR, file), 'utf-8');
      return { ok: true, status: 200, text: async () => text } as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ProvenancePanel (dev diagnostics)', () => {
  it('renders the diagnostics banner, marked not part of the visitor flow', () => {
    render(<ProvenancePanel />);
    expect(screen.getByText(/NOT PART OF THE VISITOR FLOW/i)).toBeTruthy();
  });

  it('renders a table header and one row per registry claim', async () => {
    render(<ProvenancePanel />);
    expect(screen.getByText('Source path / citation')).toBeTruthy();
    // Every claim id appears in the table.
    for (const c of PROVENANCE_CLAIMS) {
      expect(screen.getByText(c.id), `missing row for ${c.id}`).toBeTruthy();
    }
  });

  it('marks artefact claims OK once their sources load (no DRIFT against current data)', async () => {
    render(<ProvenancePanel />);
    // The summary "DRIFT" count card reads 0 against the correct numbers, and
    // at least one OK verdict badge appears once the fetches resolve. The wind
    // artefact carries a 17k-row per_round array, so allow generous time under
    // parallel test load.
    await waitFor(
      () => {
        expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
      },
      { timeout: 10000 },
    );
    // No status-badge cell reads DRIFT (the summary card label is excluded by
    // checking inside the table body rows via the badge text).
    const driftBadges = screen
      .queryAllByText('DRIFT')
      .filter((el) => el.tagName === 'SPAN');
    expect(driftBadges.length).toBe(0);
  });

  it('shows draft-pinned claims as draft-pinned, not as artefact reads', async () => {
    render(<ProvenancePanel />);
    // C25 (reserve translation) is draft-pinned: its status badge says so.
    const c25Row = screen.getByText('C25').closest('tr') as HTMLElement;
    expect(c25Row).toBeTruthy();
    const badge = within(c25Row).getByText('DRAFT-PINNED');
    expect(badge.tagName).toBe('SPAN');
  });
});
