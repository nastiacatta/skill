/**
 * Eager-chunk size guard.
 *
 * The browser must parse the eager entry chunk (`dist/assets/index-*.js`)
 * before first paint, so it is the single most important bundle to keep small.
 * Routed pages and heavy libraries (recharts, katex, framer-motion) are all
 * code-split and load lazily, so they must never leak back onto the eager path.
 *
 * This test reads the built eager chunk and asserts it stays under a ceiling
 * and contains none of the heavy-library markers that have leaked before. It is
 * a regression tripwire: if a future change pulls framer-motion, papaparse, or
 * a chart library back onto the first-paint path, the chunk balloons and this
 * fails loudly.
 *
 * It only runs when a build is present (`npm run build` writes `dist/`). With
 * no build it skips, so `npm test` on a fresh checkout stays green. To check
 * the guard locally: `npm run build && npm test`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve(__dirname, '../../../dist/assets');

/**
 * Ceiling for the eager chunk, in KB raw. The measured size after the W2
 * performance pass is ~296 KB (down from 443 KB). React, react-dom, the router,
 * and the shell account for ~290 KB of that and cannot be split, so this is
 * near the practical floor. The 330 KB ceiling leaves a little headroom for
 * routine shell growth while still catching a heavy-library leak (framer-motion
 * alone is ~120 KB), which would blow straight through it.
 */
const EAGER_CHUNK_CEILING_KB = 330;

/** Markers for heavy libraries that must stay lazy, never on the eager path. */
const FORBIDDEN_EAGER_MARKERS = ['papaparse', 'motion-dom', 'recharts'];

function findEagerChunk(): string | null {
  if (!existsSync(ASSETS_DIR)) return null;
  // The eager entry is the largest `index-*.js`. A second, tiny `index-*.js`
  // (the lazy framer AnimatePresence chunk) can also exist, so pick by size.
  const candidates = readdirSync(ASSETS_DIR)
    .filter((f) => /^index-.*\.js$/.test(f))
    .map((f) => {
      const full = path.join(ASSETS_DIR, f);
      return { full, size: readFileSync(full).length };
    })
    .sort((a, b) => b.size - a.size);
  return candidates.length > 0 ? candidates[0].full : null;
}

describe('eager bundle size guard', () => {
  const eager = findEagerChunk();

  it.skipIf(!eager)('keeps the eager index chunk under the ceiling', () => {
    const sizeKb = readFileSync(eager as string).length / 1024;
    expect(sizeKb).toBeLessThan(EAGER_CHUNK_CEILING_KB);
  });

  it.skipIf(!eager)('keeps heavy libraries off the eager path', () => {
    const content = readFileSync(eager as string, 'utf8');
    for (const marker of FORBIDDEN_EAGER_MARKERS) {
      expect(content.includes(marker)).toBe(false);
    }
  });
});
