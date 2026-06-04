import { vi } from 'vitest';

/**
 * Test-only helpers for deterministic structural snapshots (O6).
 *
 * The platform's hero surfaces animate on mount (fans expand, lines draw on,
 * tiles spring in). A snapshot of full HTML — with framer-motion's inline
 * transforms and mid-flight opacities — would be brittle and time-dependent.
 * Instead we:
 *   1. force `prefers-reduced-motion: reduce`, so every motion component renders
 *      its FINAL state immediately (`initial={false}`, `{ duration: 0 }`), with
 *      no in-between frame, no timer, no animation clock; and
 *   2. serialise only the *meaningful* structure — element tag, a fixed
 *      whitelist of semantic attributes (testid, role, aria, data-state, href,
 *      ...), and trimmed leaf text — never inline style or coordinate geometry.
 *
 * The result is a compact, human-readable outline that locks the DOM/SVG shape
 * and the semantic wiring of a component without coupling the test to pixel
 * positions (those are covered by the numeric `views`/`fanMaths`/`chartReveal`
 * suites). Geometry can be refactored freely; structure cannot silently change.
 */

/** Semantic attributes worth locking, in a fixed order for stable output. */
const ATTR_WHITELIST = [
  'data-testid',
  'role',
  'type',
  'href',
  'aria-current',
  'aria-label',
  'aria-pressed',
  'aria-live',
  'data-state',
  'data-to',
  'disabled',
  'tabindex',
] as const;

/** SVG/markup tags that carry no semantic structure on their own; collapsed to
 *  a count rather than enumerated, so a snapshot stays readable. */
const NOISE_TAGS = new Set(['defs', 'lineargradient', 'stop']);

function attrString(el: Element): string {
  const parts: string[] = [];
  for (const name of ATTR_WHITELIST) {
    if (!el.hasAttribute(name)) continue;
    const raw = el.getAttribute(name) ?? '';
    // Collapse whitespace; cap length so a stray long string cannot dominate.
    const value = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
    parts.push(value === '' ? name : `${name}="${value}"`);
  }
  return parts.length ? ` [${parts.join(' ')}]` : '';
}

/** Trimmed, whitespace-collapsed text of an element's own (leaf) text. */
function leafText(el: Element): string {
  if (el.children.length > 0) return '';
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return ` "${text.slice(0, 80)}"`;
}

export interface OutlineOptions {
  /** Maximum tree depth to descend (root is depth 0). */
  maxDepth?: number;
  /** Include trimmed leaf text on terminal nodes (default true). */
  includeText?: boolean;
}

/**
 * Recursive structural outline of an element subtree: one indented line per
 * meaningful element (`tag[attrs] "text"`). Noise wrapper tags are skipped (their
 * children are still walked). Deterministic: attribute order is fixed, no style
 * or coordinate is read, and run twice on the same render it is byte-identical.
 */
export function outline(root: Element | null, opts: OutlineOptions = {}): string {
  if (!root) return '(null)';
  const maxDepth = opts.maxDepth ?? 12;
  const includeText = opts.includeText ?? true;
  const lines: string[] = [];

  const walk = (el: Element, depth: number) => {
    const tag = el.tagName.toLowerCase();
    const noise = NOISE_TAGS.has(tag);
    let childDepth = depth;
    if (!noise) {
      const text = includeText ? leafText(el) : '';
      lines.push(`${'  '.repeat(depth)}${tag}${attrString(el)}${text}`);
      childDepth = depth + 1;
    }
    if (childDepth > maxDepth) return;
    for (const child of Array.from(el.children)) walk(child, childDepth);
  };

  walk(root, 0);
  return lines.join('\n');
}

/**
 * Coarse structural inventory of a (large) subtree: the sorted set of
 * `data-testid`s present, plus a tag-name histogram and a role histogram. Use
 * this for whole-page snapshots where a full outline would be enormous and a
 * legitimate copy edit would churn it. It still trips when a key element is
 * added, removed, or renamed.
 */
export function inventory(root: Element | null): string {
  if (!root) return '(null)';
  const testids: string[] = [];
  const tagCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();

  const bump = (map: Map<string, number>, key: string) =>
    map.set(key, (map.get(key) ?? 0) + 1);

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const id = el.getAttribute('data-testid');
    if (id) testids.push(id);
    bump(tagCounts, el.tagName.toLowerCase());
    const role = el.getAttribute('role');
    if (role) bump(roleCounts, role);
  }

  const fmtCounts = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(' ');

  return [
    `testids: ${[...new Set(testids)].sort().join(', ')}`,
    `tags: ${fmtCounts(tagCounts)}`,
    `roles: ${fmtCounts(roleCounts)}`,
  ].join('\n');
}

/**
 * Install a deterministic `matchMedia` stub. jsdom has none, and framer-motion's
 * `useReducedMotion()` reads it. Defaults to reduced-motion ON so motion
 * components render their final state with no animation clock.
 */
export function installReducedMotion(reduce = true): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reduce : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}
