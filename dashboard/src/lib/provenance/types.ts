/**
 * Provenance registry types.
 *
 * The registry maps every headline on-screen number to the single thing it is
 * allowed to come from: a committed artefact value (a JSON file under
 * `public/data/`) or a draft-pinned constant (a number that lives only in the
 * thesis draft, recorded here with its chapter citation). The automated test
 * in `__tests__/provenance` walks this registry and fails when a displayed
 * number drifts from its source.
 *
 * Nothing here re-derives or guesses. Every expected value is copied from the
 * verified currency re-check (`delta_since_1055.md` C1..C25). If a displayed
 * number has no verifiable source it is recorded with `status: 'unverifiable'`
 * rather than given an invented source.
 */

/**
 * An artefact source: a committed JSON file plus a JSON pointer to the raw
 * value, and the arithmetic the dashboard applies to turn that raw value into
 * the displayed figure. The test resolves the pointer(s) against the real file
 * and replays `derive` to check the expected value within tolerance.
 */
export interface ArtefactSource {
  kind: 'artefact';
  /** Path relative to `dashboard/public/`, e.g. `data/real_data/.../comparison.json`. */
  file: string;
  /** `json` (default) for JSON pointers, `csv` for `row:col` cell addresses. */
  format?: 'json' | 'csv';
  /**
   * Addresses read from the artefact. For JSON these are RFC 6901 pointers
   * (e.g. `/rows/2/mean_crps`). For CSV they are `<matchColumn>=<value>:<column>`
   * cell selectors (e.g. `lam=0.0:mean_profit`) or `<rowIndex>:<column>`.
   * `derive` receives the resolved values in this order.
   */
  pointers: string[];
  /**
   * Turns the raw artefact value(s) into the number the dashboard displays.
   * Pure arithmetic only. Omit for an identity read of a single pointer.
   */
  derive?: (values: number[]) => number;
  /**
   * Escape hatch for figures derived from a whole sub-structure (e.g. a median
   * or p95 over the `per_round` array). Receives the parsed artefact document
   * and returns the displayed number. When present, `pointers`/`derive` are
   * ignored. JSON artefacts only.
   */
  computeFromDoc?: (doc: unknown) => number;
}

/**
 * A draft-pinned source: a number that exists only in the thesis draft (no
 * committed dashboard artefact), recorded with its chapter citation. The test
 * asserts the literal that the dashboard renders is present in the cited source
 * file, so a future edit that changes the on-screen number without updating the
 * registry trips the gate.
 */
export interface DraftSource {
  kind: 'draft';
  /** Human chapter citation, e.g. `80_robustness.md:32`. */
  citation: string;
  /**
   * The source file (relative to `dashboard/src/`) that renders the number,
   * and the exact literal string expected in it. The test reads the file and
   * asserts the literal is present. This is how a draft-pinned constant is
   * tied back to the code that shows it. Omit for `mustNotAppearIn` claims.
   */
  rendersIn?: { file: string; literal: string };
  /**
   * For a draft-reported figure that has NO committed artefact and must never
   * be shown as a headline number (e.g. CAMS -13.5%): the literal that must be
   * absent, and the visitor-facing files it must be absent from. The test
   * asserts the literal does not appear in any listed file. This catches a
   * future edit that quietly promotes an unverifiable number onto a card.
   */
  mustNotAppearIn?: { literal: string; files: string[] };
}

export type ClaimSource = ArtefactSource | DraftSource;

/** Verification status for a registry entry. */
export type ClaimStatus =
  | 'verified' // tied to a checkable source (artefact or draft literal)
  | 'unverifiable'; // displayed but no verifiable source; flagged, never invented

export interface ProvenanceClaim {
  /** Stable id, mirrors the verified table where possible (C1..C25). */
  id: string;
  /** Human label for the diagnostics table. */
  label: string;
  /**
   * The value the dashboard displays, as a number. For percentages this is the
   * signed percentage (e.g. -7.12 for a 7.1% reduction). Copied verbatim from
   * the verified currency re-check; never re-derived here.
   */
  expected: number;
  /** Absolute tolerance for the artefact comparison. */
  tolerance: number;
  /** Unit hint for the panel display (e.g. `%`, `MW`, `t`). */
  unit?: string;
  /** Where this value comes from. */
  source: ClaimSource;
  /** Component(s) that render this number, for the diagnostics table. */
  renderedBy: string[];
  status: ClaimStatus;
  /** Optional note shown in the diagnostics table and report. */
  note?: string;
}

/** Resolve an RFC 6901 JSON pointer against a parsed JSON value. */
export function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === '') return doc;
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON pointer (must start with "/"): ${pointer}`);
  }
  const tokens = pointer
    .slice(1)
    .split('/')
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: unknown = doc;
  for (const token of tokens) {
    if (Array.isArray(cur)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) {
        throw new Error(`Pointer ${pointer}: index "${token}" out of range`);
      }
      cur = cur[idx];
    } else if (cur && typeof cur === 'object') {
      if (!(token in (cur as Record<string, unknown>))) {
        throw new Error(`Pointer ${pointer}: key "${token}" not found`);
      }
      cur = (cur as Record<string, unknown>)[token];
    } else {
      throw new Error(`Pointer ${pointer}: cannot descend into ${typeof cur} at "${token}"`);
    }
  }
  return cur;
}
