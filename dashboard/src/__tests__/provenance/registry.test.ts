/**
 * The number-provenance gate.
 *
 * For every registry entry whose source is a committed artefact, load the
 * artefact from disk, resolve its value, and assert it matches the displayed
 * expected value within tolerance. For every draft-pinned constant, assert the
 * literal the dashboard renders is present in the cited source file.
 *
 * This is the test that catches the class of bug that has bitten twice: the
 * dashboard silently drifting from the thesis draft (stale numbers, a moved
 * source, a fabricated citation). When a rendered number no longer matches its
 * source, this test fails loudly, naming the drifted claim, the expected
 * source value, and the stale displayed value.
 *
 * To prove the gate works, temporarily edit one `expected` value in
 * `claims.ts` and run `npm test` — the matching case fails with a DRIFT
 * message. (Documented in the run report.)
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PROVENANCE_CLAIMS,
  ARTEFACT_CLAIMS,
  DRAFT_CLAIMS,
  checkArtefactClaim,
  type ArtefactLoader,
} from '@/lib/provenance';

// Artefact paths in the registry are relative to `dashboard/public/`.
const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
// Draft `rendersIn` paths are relative to `dashboard/src/`.
const SRC_DIR = path.resolve(__dirname, '../..');

const loadFromDisk: ArtefactLoader = (file) =>
  readFile(path.join(PUBLIC_DIR, file), 'utf-8');

describe('provenance registry: structure', () => {
  it('every claim has a unique id', () => {
    const ids = PROVENANCE_CLAIMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every claim names at least one rendering component', () => {
    for (const c of PROVENANCE_CLAIMS) {
      expect(c.renderedBy.length, `${c.id} has no renderedBy`).toBeGreaterThan(0);
    }
  });

  it('artefact and draft partitions cover all claims', () => {
    expect(ARTEFACT_CLAIMS.length + DRAFT_CLAIMS.length).toBe(PROVENANCE_CLAIMS.length);
  });
});

describe('provenance gate: artefact-backed claims match their source', () => {
  // One assertion per artefact claim so a drift names exactly which claim broke.
  for (const claim of ARTEFACT_CLAIMS) {
    it(`${claim.id} — ${claim.label}`, async () => {
      const check = await checkArtefactClaim(claim, loadFromDisk);
      // The detail string carries the expected/source/tolerance, so a failure
      // reads cleanly without further digging.
      expect(check.ok, check.detail).toBe(true);
    });
  }
});

describe('provenance gate: draft-pinned constants are present in the cited code', () => {
  for (const claim of DRAFT_CLAIMS) {
    it(`${claim.id} — ${claim.label}`, async () => {
      if (claim.source.kind !== 'draft') throw new Error('partition error');
      const { rendersIn, mustNotAppearIn, citation } = claim.source;

      if (rendersIn) {
        const src = await readFile(path.join(SRC_DIR, rendersIn.file), 'utf-8');
        expect(
          src.includes(rendersIn.literal),
          `${claim.id} DRIFT: draft-pinned literal "${rendersIn.literal}" (cited ${citation}) ` +
            `was not found in ${rendersIn.file}. The displayed number may have moved away from its draft source.`,
        ).toBe(true);
      }

      if (mustNotAppearIn) {
        for (const file of mustNotAppearIn.files) {
          const src = await readFile(path.join(SRC_DIR, file), 'utf-8');
          expect(
            src.includes(mustNotAppearIn.literal),
            `${claim.id} DRIFT: unverifiable figure "${mustNotAppearIn.literal}" (cited ${citation}, ` +
              `no committed artefact) appears in ${file}. A draft-reported number must not be shown as a headline.`,
          ).toBe(false);
        }
      }

      expect(
        Boolean(rendersIn || mustNotAppearIn),
        `${claim.id} draft claim has neither rendersIn nor mustNotAppearIn`,
      ).toBe(true);
    });
  }
});

describe('provenance gate: unverifiable claims are flagged, never silently artefact-backed', () => {
  it('unverifiable claims carry a note and are not artefact-sourced', () => {
    const unverifiable = PROVENANCE_CLAIMS.filter((c) => c.status === 'unverifiable');
    for (const c of unverifiable) {
      // No unverifiable claims remain after CAMS (C12) was promoted to an
      // artefact-backed entry. This loop now iterates an empty set and the
      // assertion holds vacuously; it stays as a guard against a future
      // unverifiable claim being added without a note or with an invented
      // artefact source.
      expect(c.note, `${c.id} unverifiable but has no explanatory note`).toBeTruthy();
      expect(
        c.source.kind,
        `${c.id} is unverifiable but claims an artefact source — that would invent provenance`,
      ).toBe('draft');
    }
  });
});
