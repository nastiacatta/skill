import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ThesisRef from '@/components/dashboard/ThesisRef';
import {
  COMPANION_REFS,
  SECTION_INDEX,
  type CompanionKey,
  type CompanionRef,
} from '@/lib/platform/companionContent';
import { PROVENANCE_CLAIMS } from '@/lib/provenance';

/**
 * Thesis-companion signposting (U2). The companion lines must:
 *  - render the draft section label and verbatim heading on each view,
 *  - use only claim ids that resolve to a real provenance-registry entry,
 *  - match the compiled-draft section numbers for the load-bearing views,
 *  - and carry no em-dash or prose semicolon (project style rules).
 *
 * The draft is the source of truth: the section numbers asserted below are the
 * reader-facing numbers from the compiled table of contents
 * (Results = Ch 4, Post-hoc calibration = §4.3, Robustness = §4.4).
 */

afterEach(cleanup);

function renderRef(viewKey: CompanionKey) {
  return render(
    <MemoryRouter>
      <ThesisRef viewKey={viewKey} />
    </MemoryRouter>,
  );
}

describe('companion signposting: per-view draft-section labels', () => {
  // A sample of views across the platform and research zones, each with the
  // draft section label the compiled TOC pins it to.
  const SAMPLE: Array<{ key: CompanionKey; section: string; titleFragment: string }> = [
    { key: 'evidence', section: '§4.2', titleFragment: 'Real-data validation' },
    { key: 'robustness', section: '§4.4', titleFragment: 'Robustness' },
    { key: 'platform/stress', section: '§4.4', titleFragment: 'Robustness' },
    { key: 'evidence/calibration', section: '§4.3', titleFragment: 'Post-hoc calibration' },
    { key: 'explainer', section: '§2.1', titleFragment: 'Round structure' },
    { key: 'platform/market', section: '§2.1.3', titleFragment: 'Step 3: aggregation' },
    { key: 'platform/leaderboard', section: '§4.2.1.1', titleFragment: 'Per-forecaster skill and weight ordering' },
    { key: 'appendix/diagnostics', section: '§4.2.1.3', titleFragment: 'Audit-slice replication' },
  ];

  for (const { key, section, titleFragment } of SAMPLE) {
    it(`${key} names ${section} ${titleFragment}`, () => {
      renderRef(key);
      const line = screen.getByText(/Companion to thesis/i);
      expect(line.textContent).toContain(section);
      expect(line.textContent).toContain(titleFragment);
    });
  }
});

describe('companion signposting: provenance integrity', () => {
  const KNOWN = new Set(PROVENANCE_CLAIMS.map((c) => c.id));

  it('every claim id on a companion line resolves to a registry entry (by prefix)', () => {
    // Registry ids are sometimes split (C3-lower, C8-sigma-xgb, C10-dm). A
    // companion chip names the family (C3, C8, C10), so a chip is valid when at
    // least one registry id starts with it.
    const families = new Set<string>();
    for (const c of KNOWN) families.add(c.split('-')[0]);

    for (const ref of Object.values(COMPANION_REFS) as CompanionRef[]) {
      for (const id of ref.claims ?? []) {
        expect(families.has(id), `companion claim ${id} has no provenance entry`).toBe(true);
      }
    }
  });

  it('never surfaces the unverifiable CAMS figure (C12) on a companion line', () => {
    for (const ref of Object.values(COMPANION_REFS) as CompanionRef[]) {
      expect(ref.claims ?? []).not.toContain('C12');
    }
  });
});

describe('companion signposting: section index covers the homeless chapters', () => {
  it('gives Chapter 3 and §4.3 a findable home', () => {
    const text = SECTION_INDEX.map((r) => r.chapter).join(' | ');
    expect(text).toContain('Ch 3 Implementation and evaluation');
    expect(text).toContain('§4.3 Post-hoc calibration');
    expect(text).toContain('§4.4 Robustness');
  });

  it('every index row points at a real in-app route', () => {
    const ROUTES = new Set([
      '/research', '/explainer', '/notes', '/appendix', '/appendix/diagnostics',
      '/evidence', '/platform/market', '/platform/stress', '/robustness',
    ]);
    for (const row of SECTION_INDEX) {
      for (const v of row.views) {
        expect(ROUTES.has(v.to), `index route ${v.to} is not a known route`).toBe(true);
      }
    }
  });
});

describe('companion signposting: copy hygiene', () => {
  it('carries no em-dash and no prose semicolon', () => {
    const strings: string[] = [];
    for (const ref of Object.values(COMPANION_REFS) as CompanionRef[]) {
      strings.push(ref.section, ref.title);
      if (ref.note) strings.push(ref.note);
    }
    for (const row of SECTION_INDEX) {
      strings.push(row.chapter);
      for (const v of row.views) strings.push(v.label);
    }
    for (const s of strings) {
      expect(s.includes('—'), `em-dash in companion copy: "${s}"`).toBe(false);
      expect(s.includes(';'), `semicolon in companion copy: "${s}"`).toBe(false);
    }
  });
});
