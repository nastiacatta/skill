import { storyPalette } from './storyPalette';
import { STORY_STEPS, STORY_STEP_LABELS } from './useStoryPipeline';

export { STORY_STEP_LABELS as STEP_NAMES };

export interface StoryStepIndicatorProps {
  activeStep: number;
}

export default function StoryStepIndicator({
  activeStep,
}: StoryStepIndicatorProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={activeStep + 1}
      aria-valuemin={1}
      aria-valuemax={STORY_STEPS}
      aria-label={`Step ${activeStep + 1} of ${STORY_STEPS}: ${STORY_STEP_LABELS[activeStep] ?? ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        padding: '0 4px',
      }}
    >
      {/* Labels row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {Array.from({ length: STORY_STEPS }).map((_, i) => {
          const isActive = i === activeStep;
          const isCompleted = i < activeStep;
          return (
            <span
              key={i}
              style={{
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? storyPalette.pool.stroke
                  : isCompleted
                    ? storyPalette.text.body
                    : storyPalette.text.muted,
                opacity: isActive ? 1 : isCompleted ? 0.85 : 0.55,
                transition: 'all 0.25s ease',
                textAlign: 'center',
                flex: 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {STORY_STEP_LABELS[i]}
            </span>
          );
        })}
      </div>

      {/* Segmented progress bar */}
      <div
        style={{
          display: 'flex',
          gap: 3,
          width: '100%',
          height: 4,
        }}
      >
        {Array.from({ length: STORY_STEPS }).map((_, i) => {
          const isCompleted = i < activeStep;
          const isActive = i === activeStep;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '100%',
                borderRadius: 2,
                background: isCompleted || isActive
                  ? storyPalette.pool.stroke
                  : storyPalette.surface.border,
                opacity: isActive ? 0.7 : isCompleted ? 1 : 1,
                transition: 'background 0.3s ease, opacity 0.3s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
