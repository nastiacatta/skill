/**
 * Pure presentation tile for the principal at the left rail of the
 * Story stage. Reads the frame index and the two reward scalars and
 * renders the resting glyph; flight motion is owned by the parent
 * stage. No internal state, no side effects.
 */

import type { StoryFrameIndex } from './useStoryPipeline';
import { storyPalette } from './storyPalette';

export interface StoryClientTileProps {
  frame: StoryFrameIndex;
  rewardPosted: number;
  rewardDistributed: number;
}

export default function StoryClientTile({
  frame,
  rewardPosted,
  rewardDistributed,
}: StoryClientTileProps) {
  const tokenInside = frame === 0;
  const returnPath = frame >= 6;

  return (
    <div
      className="p-6"
      style={{
        background: storyPalette.surface.tile,
        border: `1px solid ${storyPalette.surface.border}`,
        borderLeft: `3px solid ${storyPalette.pool.stroke}`,
        borderRadius: 4,
        minWidth: 168,
      }}
    >
      <p
        className="eyebrow"
        style={{ color: storyPalette.pool.stroke, marginBottom: 10 }}
      >
        Principal
      </p>

      <div
        className="font-serif"
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: storyPalette.text.body,
          lineHeight: 1.3,
        }}
      >
        Grid operator
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 13,
          color: storyPalette.text.muted,
          lineHeight: 1.4,
        }}
      >
        posts task, pays out
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 13,
            background: tokenInside
              ? storyPalette.pool.fill
              : 'transparent',
            border: `1.5px solid ${
              tokenInside ? storyPalette.pool.stroke : storyPalette.inactive
            }`,
            color: tokenInside
              ? storyPalette.pool.stroke
              : storyPalette.inactive,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
        >
          R
        </span>
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: 14,
            color: tokenInside
              ? storyPalette.text.body
              : storyPalette.text.muted,
          }}
        >
          {rewardPosted.toFixed(2)}
        </span>
      </div>

      {returnPath && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: storyPalette.text.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden>
            <path
              d="M14 5H1m4 -4 -4 4 4 4"
              stroke={storyPalette.pool.stroke}
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-mono tabular-nums">
            {rewardDistributed.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
