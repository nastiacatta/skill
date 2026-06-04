/**
 * Single colour authority for the Story page.
 *
 * Re-exports values from the canonical sources so the Story tiles, the
 * deposit-token glyphs, and the aggregate fan agree with the slide deck
 * (PALETTE), the thesis figure register (THESIS_PALETTE), and the
 * dashboard CSS variables. No new hex literals are introduced beyond
 * the deeper-teal sibling for the F2a / F2b sybil split, which is
 * pulled from the --teal-deep CSS custom property.
 */

import { PALETTE } from '@/components/slides/shared/presentationConstants';
import { ORANGE, THESIS_PALETTE } from '@/lib/palette';

const TEAL_DEEP = '#246E6E';

export const STORY_FORECASTERS = [
  PALETTE.navy,
  PALETTE.teal,
  PALETTE.coral,
  PALETTE.purple,
  ORANGE,
  PALETTE.slate,
] as const;

export type StoryForecasterColour = (typeof STORY_FORECASTERS)[number];

export const storyPalette = {
  forecasters: STORY_FORECASTERS,

  pool: {
    fill: '#EEF2F9',
    stroke: PALETTE.navy,
  },

  outcome: '#000000',

  aggregate: {
    line: THESIS_PALETTE.proposed,
    band: 'rgba(91, 155, 213, 0.3)',
  },

  payoutPositive: PALETTE.teal,
  payoutNegative: PALETTE.coral,

  scoreBadge: {
    positive: { bg: '#E7F3F1', fg: '#115E59' },
    negative: { bg: '#FCEDEA', fg: '#991B1B' },
  },

  sybilSiblings: {
    a: PALETTE.teal,
    b: TEAL_DEEP,
  },

  inactive: '#8C92A3',

  text: {
    body: '#0B1220',
    muted: '#5A6175',
    caption: '#2B3246',
  },

  surface: {
    page: '#FFFFFF',
    tile: '#FFFFFF',
    border: '#E5E7EB',
  },
} as const;

export type StoryPaletteRole = keyof typeof storyPalette;

export function forecasterColour(index: number): string {
  return STORY_FORECASTERS[index % STORY_FORECASTERS.length];
}
