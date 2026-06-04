/**
 * Resolves a registry claim to the value its source actually holds.
 *
 * Used by the provenance test (Node) to load committed artefacts from disk and
 * by the dev panel (browser) to fetch them. Both paths share the same pointer
 * and CSV addressing so the table and the gate agree.
 */

import type { ArtefactSource, ProvenanceClaim } from './types';
import { resolvePointer } from './types';

/** A loader returns the raw text of an artefact given its `public/`-relative path. */
export type ArtefactLoader = (file: string) => Promise<string>;

/** Parse a CSV into header + rows of strings. Minimal, no quoting support. */
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((l) => l.split(','));
  return { header, rows };
}

/**
 * Read one CSV cell. Selector forms:
 *  - `<matchColumn>=<value>:<column>` (find the row where matchColumn equals
 *    value, read column)
 *  - `<rowIndex>:<column>` (read column at a zero-based data-row index)
 */
function readCsvCell(text: string, selector: string): number {
  const { header, rows } = parseCsv(text);
  const [rowSel, col] = selector.split(':');
  const colIdx = header.indexOf(col);
  if (colIdx < 0) throw new Error(`CSV column "${col}" not found (selector ${selector})`);
  let row: string[] | undefined;
  if (rowSel.includes('=')) {
    const [matchCol, matchVal] = rowSel.split('=');
    const matchIdx = header.indexOf(matchCol);
    if (matchIdx < 0) throw new Error(`CSV match column "${matchCol}" not found`);
    row = rows.find((r) => r[matchIdx] === matchVal);
  } else {
    row = rows[Number(rowSel)];
  }
  if (!row) throw new Error(`CSV row not found for selector ${selector}`);
  const v = Number(row[colIdx]);
  if (!Number.isFinite(v)) throw new Error(`CSV cell "${selector}" is not finite: ${row[colIdx]}`);
  return v;
}

/**
 * Resolve an artefact-backed claim to its source value, applying the claim's
 * `computeFromDoc`, `derive`, or identity read in that order of precedence.
 */
export async function resolveArtefactValue(
  source: ArtefactSource,
  load: ArtefactLoader,
): Promise<number> {
  const text = await load(source.file);

  if (source.format === 'csv') {
    const values = source.pointers.map((p) => readCsvCell(text, p));
    return source.derive ? source.derive(values) : values[0];
  }

  const doc = JSON.parse(text);
  if (source.computeFromDoc) return source.computeFromDoc(doc);
  const values = source.pointers.map((p) => {
    const v = resolvePointer(doc, p);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Pointer ${p} in ${source.file} did not resolve to a finite number (got ${JSON.stringify(v)})`);
    }
    return v;
  });
  return source.derive ? source.derive(values) : values[0];
}

export interface ClaimCheck {
  claim: ProvenanceClaim;
  /** The value the source actually holds (artefact) or `null` for draft claims. */
  sourceValue: number | null;
  /** Absolute difference between expected and source (artefact only). */
  delta: number | null;
  /** True when the claim is within tolerance (artefact) or the literal is present (draft). */
  ok: boolean;
  /** Human explanation, used by both the test failure message and the panel. */
  detail: string;
}

/**
 * Check a single artefact-backed claim. Draft claims are checked separately
 * (the test reads source files; the browser panel cannot read `src/`).
 */
export async function checkArtefactClaim(
  claim: ProvenanceClaim,
  load: ArtefactLoader,
): Promise<ClaimCheck> {
  if (claim.source.kind !== 'artefact') {
    throw new Error(`checkArtefactClaim called on non-artefact claim ${claim.id}`);
  }
  try {
    const sourceValue = await resolveArtefactValue(claim.source, load);
    const delta = Math.abs(sourceValue - claim.expected);
    const ok = delta <= claim.tolerance;
    const detail = ok
      ? `${claim.id} OK: source ${sourceValue} matches expected ${claim.expected} (|Δ| ${delta.toExponential(2)} ≤ tol ${claim.tolerance}).`
      : `${claim.id} DRIFT: "${claim.label}" displays ${claim.expected} but ${claim.source.file} yields ${sourceValue} (|Δ| ${delta.toExponential(2)} > tol ${claim.tolerance}).`;
    return { claim, sourceValue, delta, ok, detail };
  } catch (e) {
    return {
      claim,
      sourceValue: null,
      delta: null,
      ok: false,
      detail: `${claim.id} ERROR loading source: ${(e as Error).message}`,
    };
  }
}
