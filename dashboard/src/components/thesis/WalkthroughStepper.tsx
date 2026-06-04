import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { WalkthroughStepId } from '@/lib/thesis';
import { WALKTHROUGH_STEPS, WALKTHROUGH_STEP_LABELS } from '@/lib/thesis';

interface WalkthroughStepperProps {
  currentStep: WalkthroughStepId;
  /** Optional: build step URL with query params */
  getStepUrl?: (step: WalkthroughStepId) => string;
}

export default function WalkthroughStepper({
  currentStep,
  getStepUrl,
}: WalkthroughStepperProps) {
  const currentIndex = WALKTHROUGH_STEPS.indexOf(currentStep);

  return (
    <nav
      className="flex items-center gap-0 border-b border-slate-200 bg-white px-2 overflow-x-auto"
      aria-label="Walkthrough steps"
    >
      {WALKTHROUGH_STEPS.map((stepId, i) => {
        const isActive = stepId === currentStep;
        const isPast = i < currentIndex;
        const href = getStepUrl?.(stepId) ?? `?step=${stepId}`;
        const content = (
          <>
            <span
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isActive && 'bg-blue-600 text-white',
                isPast && !isActive && 'bg-slate-200 text-slate-600',
                !isActive && !isPast && 'bg-slate-100 text-slate-500'
              )}
            >
              {i + 1}
            </span>
            <span
              className={clsx(
                'hidden sm:inline text-xs font-medium whitespace-nowrap',
                isActive ? 'text-slate-900' : 'text-slate-500'
              )}
            >
              {WALKTHROUGH_STEP_LABELS[stepId]}
            </span>
          </>
        );
        return (
          <span key={stepId} className="flex items-center gap-2">
            {getStepUrl ? (
              <Link
                to={href}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  isActive ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'
                )}
              >
                {content}
              </Link>
            ) : (
              <span
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  isActive && 'bg-blue-50 text-blue-800'
                )}
              >
                {content}
              </span>
            )}
            {i < WALKTHROUGH_STEPS.length - 1 && (
              <span className="text-slate-300 shrink-0">→</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
