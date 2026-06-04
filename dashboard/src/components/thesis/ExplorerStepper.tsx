/**
 * Horizontal stepper for Mechanism explorer: Inputs → DGP → Core → Behaviour → Results
 */
import clsx from 'clsx';
import type { ExplorerStageId } from '@/lib/thesis';
import { EXPLORER_STAGES, EXPLORER_STAGE_LABELS } from '@/lib/thesis';

interface ExplorerStepperProps {
  currentStage: ExplorerStageId;
  onSelectStage: (stage: ExplorerStageId) => void;
}

export default function ExplorerStepper({ currentStage, onSelectStage }: ExplorerStepperProps) {
  const currentIndex = EXPLORER_STAGES.indexOf(currentStage);

  return (
    <nav
      className="flex items-center gap-0 border-b border-slate-200 bg-white px-2 overflow-x-auto"
      aria-label="Mechanism stages"
    >
      {EXPLORER_STAGES.map((stageId, i) => {
        const isActive = stageId === currentStage;
        const isPast = i < currentIndex;
        return (
          <button
            key={stageId}
            type="button"
            onClick={() => onSelectStage(stageId)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2.5 rounded-t-lg transition-colors border-b-2 -mb-px',
              isActive && 'border-blue-600 bg-blue-50/50 text-blue-800',
              isPast && !isActive && 'border-transparent text-slate-600 hover:bg-slate-50',
              !isActive && !isPast && 'border-transparent text-slate-500 hover:bg-slate-50'
            )}
          >
            <span
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isActive && 'bg-blue-600 text-white',
                isPast && !isActive && 'bg-slate-200 text-slate-600',
                !isActive && !isPast && 'bg-slate-100 text-slate-500'
              )}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">
              {EXPLORER_STAGE_LABELS[stageId]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
