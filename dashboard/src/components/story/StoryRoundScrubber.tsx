/**
 * Round-level scrubber. Pure render: emits onRoundChange on user
 * input and reflects currentRound in the readout. Mirrors the
 * Prev / range / Next idiom used in RoundReplayPanel so the look
 * is consistent across lab and story surfaces.
 */

import { storyPalette } from './storyPalette';

export interface StoryRoundScrubberProps {
  currentRound: number;
  totalRounds: number;
  onRoundChange: (round: number) => void;
  frameMarkers?: number[];
}

export default function StoryRoundScrubber({
  currentRound,
  totalRounds,
  onRoundChange,
  frameMarkers,
}: StoryRoundScrubberProps) {
  const lastIndex = Math.max(0, totalRounds - 1);
  const safeRound = Math.max(0, Math.min(lastIndex, currentRound));

  const markers = (frameMarkers ?? []).filter(
    (round) => round >= 0 && round <= lastIndex,
  );

  return (
    <div
      style={{
        background: storyPalette.surface.tile,
        border: `1px solid ${storyPalette.surface.border}`,
        borderRadius: 4,
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => onRoundChange(Math.max(0, safeRound - 1))}
          aria-label="previous round"
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'var(--cream)',
            color: storyPalette.text.muted,
            border: `1px solid ${storyPalette.surface.border}`,
          }}
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => onRoundChange(Math.min(lastIndex, safeRound + 1))}
          aria-label="next round"
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'var(--cream)',
            color: storyPalette.text.muted,
            border: `1px solid ${storyPalette.surface.border}`,
          }}
        >
          Next →
        </button>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
            position: 'relative',
          }}
        >
          <span
            className="eyebrow"
            style={{ color: storyPalette.text.muted, fontSize: 10 }}
          >
            Round
          </span>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="range"
              min={0}
              max={lastIndex}
              value={safeRound}
              onChange={(event) => onRoundChange(Number(event.target.value))}
              aria-label={`Jump to round ${safeRound + 1}`}
              style={{
                width: '100%',
                accentColor: storyPalette.pool.stroke,
                height: 4,
              }}
            />
            {markers.length > 0 && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  insetInline: 0,
                  bottom: -4,
                  height: 6,
                  pointerEvents: 'none',
                }}
              >
                {markers.map((marker) => {
                  const pct = lastIndex === 0 ? 0 : (marker / lastIndex) * 100;
                  return (
                    <span
                      key={marker}
                      style={{
                        position: 'absolute',
                        left: `${pct}%`,
                        transform: 'translateX(-50%)',
                        width: 2,
                        height: 6,
                        background: storyPalette.aggregate.line,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: 12,
              color: storyPalette.text.body,
              minWidth: 76,
              textAlign: 'right',
            }}
          >
            {safeRound + 1} / {totalRounds}
          </span>
        </div>
      </div>
    </div>
  );
}
