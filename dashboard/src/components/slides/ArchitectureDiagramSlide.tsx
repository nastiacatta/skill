import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

/**
 * Slide 8: Architecture — Five-step mechanism pipeline (left-to-right).
 *
 * Shows one round of the mechanism:
 * Submit → Eff. Wager → Aggregate → Settle → Skill Update
 *
 * Layout: viewBox 0 0 900 550, pipeline centred around y=160
 *
 * Fixes applied:
 * - Removed dual connection curve (cluttering; forward arrows show flow)
 * - Removed "mᵢ → exposure" label
 * - Moved refund annotation ABOVE the Eff. Wager box
 * - Feedback loop goes lower (y_bottom=480) for clearance
 * - "yₜ observed" diamond and text larger (fontSize 14)
 * - viewBox expanded to 900×550, BOX_CENTER_Y=160
 * - No maxWidth constraint — SVG fills available space
 */

interface PipelineStep {
  id: string;
  label: string;
  formula: string;
  color: string;
  x: number;
}

const BOX_WIDTH = 140;
const BOX_HEIGHT = 100;
const BOX_RX = 12;
const BOX_CENTER_Y = 160;
const BOX_TOP = BOX_CENTER_Y - BOX_HEIGHT / 2;

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'submit', label: 'Submit', formula: 'rᵢ, bᵢ', color: PALETTE.imperial, x: 40 },
  { id: 'wager', label: 'Eff. Wager', formula: 'mᵢ = bᵢ·g(σᵢ)', color: PALETTE.teal, x: 200 },
  { id: 'aggregate', label: 'Aggregate', formula: 'r̂ = Σ wᵢrᵢ', color: PALETTE.teal, x: 360 },
  { id: 'settle', label: 'Settle', formula: 'Πᵢ = mᵢ(1+sᵢ−s̄)', color: PALETTE.teal, x: 520 },
  { id: 'update', label: 'Skill Update', formula: 'EWMA(loss)', color: PALETTE.purple, x: 680 },
];

export default function ArchitectureDiagramSlide() {
  const wagerBox = PIPELINE_STEPS[1];
  const settleBox = PIPELINE_STEPS[3];

  // Feedback loop path coordinates
  const feedbackStartX = PIPELINE_STEPS[4].x + BOX_WIDTH;
  const feedbackEndX = PIPELINE_STEPS[0].x;
  const feedbackY = BOX_CENTER_Y;
  const feedbackBottomY = 480;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox="0 0 900 550"
        style={{ width: '100%', height: 'auto' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="pipe-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={PALETTE.slate} />
          </marker>
          <marker id="feedback-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={PALETTE.coral} />
          </marker>
        </defs>

        {/* ─── "Round t" header label ─── */}
        <text
          x={450}
          y={50}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="22"
          fontWeight={700}
          fill={PALETTE.navy}
        >
          Round t
        </text>

        {/* ─── Pipeline step boxes ─── */}
        {PIPELINE_STEPS.map((step) => (
          <g key={step.id}>
            <rect
              x={step.x}
              y={BOX_TOP}
              width={BOX_WIDTH}
              height={BOX_HEIGHT}
              rx={BOX_RX}
              fill={step.color + '12'}
              stroke={step.color}
              strokeWidth={2}
            />
            <text
              x={step.x + BOX_WIDTH / 2}
              y={BOX_CENTER_Y - 10}
              textAnchor="middle"
              fontFamily={TYPOGRAPHY.fontFamily}
              fontSize="16"
              fontWeight={700}
              fill={step.color}
            >
              {step.label}
            </text>
            <text
              x={step.x + BOX_WIDTH / 2}
              y={BOX_CENTER_Y + 18}
              textAnchor="middle"
              fontFamily={TYPOGRAPHY.fontFamily}
              fontSize="13"
              fontWeight={500}
              fill={PALETTE.charcoal}
            >
              {step.formula}
            </text>
          </g>
        ))}

        {/* ─── Forward arrows between steps ─── */}
        {PIPELINE_STEPS.slice(0, -1).map((step, i) => {
          const x1 = step.x + BOX_WIDTH;
          const x2 = PIPELINE_STEPS[i + 1].x;
          return (
            <line
              key={`arrow-${step.id}`}
              x1={x1 + 4}
              y1={BOX_CENTER_Y}
              x2={x2 - 4}
              y2={BOX_CENTER_Y}
              stroke={PALETTE.slate}
              strokeWidth={2}
              markerEnd="url(#pipe-arrow)"
            />
          );
        })}

        {/* ─── Feedback loop: dashed curved path from Skill Update → Submit ─── */}
        <path
          d={`M ${feedbackStartX} ${feedbackY}
              C ${feedbackStartX + 60} ${feedbackBottomY},
                ${feedbackEndX - 60} ${feedbackBottomY},
                ${feedbackEndX} ${feedbackY}`}
          fill="none"
          stroke={PALETTE.coral}
          strokeWidth={2}
          strokeDasharray="8 4"
          markerEnd="url(#feedback-arrow)"
        />
        {/* Feedback loop label */}
        <text
          x={450}
          y={feedbackBottomY + 30}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="13"
          fontWeight={600}
          fill={PALETTE.coral}
        >
          {"W\u2032\u1D62, \u03C3\u2032\u1D62 \u2192 next round"}
        </text>

        {/* ─── "yₜ observed" marker between Aggregate and Settle ─── */}
        <g>
          {/* Diamond marker — slightly larger */}
          <polygon
            points={`${480},${BOX_TOP - 34} ${490},${BOX_TOP - 24} ${480},${BOX_TOP - 14} ${470},${BOX_TOP - 24}`}
            fill={PALETTE.coral + '30'}
            stroke={PALETTE.coral}
            strokeWidth={1.5}
          />
          {/* Label — fontSize 14 */}
          <text
            x={480}
            y={BOX_TOP - 46}
            textAnchor="middle"
            fontFamily={TYPOGRAPHY.fontFamily}
            fontSize="14"
            fontWeight={600}
            fill={PALETTE.coral}
          >
            yₜ observed
          </text>
          {/* Dashed line down to pipeline */}
          <line
            x1={480}
            y1={BOX_TOP - 14}
            x2={480}
            y2={BOX_TOP}
            stroke={PALETTE.coral}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        </g>

        {/* ─── Budget balance annotation below Settle ─── */}
        <text
          x={settleBox.x + BOX_WIDTH / 2}
          y={BOX_TOP + BOX_HEIGHT + 28}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="12"
          fontWeight={600}
          fill={PALETTE.teal}
        >
          Σ Πᵢ = Σ mᵢ
        </text>

        {/* ─── Refund annotation ABOVE Eff. Wager box ─── */}
        <text
          x={wagerBox.x + BOX_WIDTH / 2}
          y={BOX_TOP - 18}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="11"
          fontWeight={500}
          fill={PALETTE.slate}
        >
          (bᵢ − mᵢ) refunded
        </text>
      </svg>
    </div>
  );
}
