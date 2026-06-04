import SlideShell from './shared/SlideShell';
import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

/**
 * Slide 4: Where This Work Fits — 2x2 positioning matrix.
 * 4 nodes: Lambert, Raja, Vitali & Pinson, THIS PROJECT.
 * "Online Aggregation" removed — too generic.
 */

interface MatrixNode {
  id: string;
  label: string;
  citation: string;
  detail: string;
  x: number; // percentage position in chart area
  y: number;
  isThesis?: boolean;
}

const NODES: MatrixNode[] = [
  { id: 'lambert', label: 'Lambert et al. (2008)', citation: 'Self-financed wager-based settlement', detail: '7 formal properties, uniqueness theorem', x: 25, y: 15 },
  { id: 'raja', label: 'Raja et al. (2024)', citation: 'Prediction-market architecture', detail: 'Client reward, payoff allocation', x: 25, y: 38 },
  { id: 'vitali', label: 'Vitali & Pinson (2025)', citation: 'Repeated adaptation, intermittent', detail: 'Online regression, Shapley payoff', x: 75, y: 72 },
  { id: 'thesis', label: 'THIS PROJECT', citation: 'Adaptive + self-financed', detail: 'Skill learning + Lambert properties', x: 75, y: 25, isThesis: true },
];

/** Node numbering: circled number (or star for thesis) */
const NODE_NUMBER: Record<string, string> = {
  lambert: '1',
  raja: '2',
  vitali: '3',
  thesis: '★',
};

export default function PositioningMatrixSlide() {
  const chartX = 60;
  const chartY = 30;
  const chartW = 1080;
  const chartH = 620;
  const midX = chartX + chartW / 2;
  const midY = chartY + chartH / 2;
  const cardW = 320;
  const cardH = 120;

  // Helper: get card center position
  function getCardCenter(node: MatrixNode) {
    return {
      cx: chartX + (node.x / 100) * chartW,
      cy: chartY + (node.y / 100) * chartH,
    };
  }

  // Helper: get the point on the card edge closest to a target point
  function getEdgePoint(node: MatrixNode, targetX: number, targetY: number) {
    const { cx, cy } = getCardCenter(node);
    const dx = targetX - cx;
    const dy = targetY - cy;
    const halfW = cardW / 2;
    const halfH = cardH / 2;

    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const scaleX = halfW / (absDx || 1);
    const scaleY = halfH / (absDy || 1);
    const scale = Math.min(scaleX, scaleY);

    return {
      x: cx + dx * scale,
      y: cy + dy * scale,
    };
  }

  return (
    <SlideShell title="Where This Work Fits" slideNumber={4} highlight="Combining the three: memory across rounds + disciplined settlement + intermittency → Gap: adaptive + self-financed + absolute skill" refText="Lambert et al., 2008 · Raja et al., 2024 · Vitali & Pinson, 2025">
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <svg
        viewBox="0 0 1200 750"
        style={{ width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="pm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Quadrant background tints */}
        <rect x={chartX} y={chartY} width={chartW / 2} height={chartH / 2} fill="rgba(0, 62, 116, 0.04)" rx={4} />
        <rect x={midX} y={chartY} width={chartW / 2} height={chartH / 2} fill="rgba(46, 139, 139, 0.06)" rx={4} />
        <rect x={chartX} y={midY} width={chartW / 2} height={chartH / 2} fill="rgba(100, 116, 139, 0.02)" rx={4} />
        <rect x={midX} y={midY} width={chartW / 2} height={chartH / 2} fill="rgba(0, 62, 116, 0.03)" rx={4} />

        {/* Chart border */}
        <rect x={chartX} y={chartY} width={chartW} height={chartH} fill="none" stroke={PALETTE.border} strokeWidth={1.5} rx={4} />

        {/* Dashed dividers */}
        <line x1={midX} y1={chartY} x2={midX} y2={chartY + chartH} stroke={PALETTE.border} strokeWidth={2} strokeDasharray="8 6" />
        <line x1={chartX} y1={midY} x2={chartX + chartW} y2={midY} stroke={PALETTE.border} strokeWidth={2} strokeDasharray="8 6" />

        {/* X-axis labels: endpoints + axis title on a separate line */}
        <text x={chartX + 20} y={chartY + chartH + 34} fontFamily={TYPOGRAPHY.fontFamily} fontSize="18" fill={PALETTE.slate}>
          Static (no learning)
        </text>
        <text x={chartX + chartW - 20} y={chartY + chartH + 34} textAnchor="end" fontFamily={TYPOGRAPHY.fontFamily} fontSize="18" fill={PALETTE.slate}>
          Adaptive (learns over time)
        </text>
        <text x={chartX + chartW / 2} y={chartY + chartH + 64} textAnchor="middle" fontFamily={TYPOGRAPHY.fontFamily} fontSize="19" fill={PALETTE.navy} fontWeight={600}>
          Adaptiveness →
        </text>

        {/* Y-axis endpoints + axis title */}
        <text
          x={chartX - 22} y={chartY + chartH - 8}
          fontFamily={TYPOGRAPHY.fontFamily} fontSize="18" fill={PALETTE.slate}
          transform={`rotate(-90, ${chartX - 22}, ${chartY + chartH - 8})`}
          textAnchor="start"
        >
          Not self-financed
        </text>
        <text
          x={chartX - 22} y={chartY + 8}
          fontFamily={TYPOGRAPHY.fontFamily} fontSize="18" fill={PALETTE.slate}
          transform={`rotate(-90, ${chartX - 22}, ${chartY + 8})`}
          textAnchor="end"
        >
          Self-financed
        </text>
        <text
          x={chartX - 52} y={chartY + chartH / 2}
          fontFamily={TYPOGRAPHY.fontFamily} fontSize="19" fill={PALETTE.navy} fontWeight={600}
          transform={`rotate(-90, ${chartX - 52}, ${chartY + chartH / 2})`}
          textAnchor="middle"
        >
          Financing →
        </text>

        {/* Dashed connection lines from existing work to project — start/end at card edges */}
        {NODES.filter(n => !n.isThesis).map((node) => {
          const thesis = NODES.find(n => n.isThesis)!;
          const { cx: thesisCx, cy: thesisCy } = getCardCenter(thesis);
          const { cx: nodeCx, cy: nodeCy } = getCardCenter(node);

          const startPt = getEdgePoint(node, thesisCx, thesisCy);
          const endPt = getEdgePoint(thesis, nodeCx, nodeCy);

          return (
            <line
              key={`line-${node.id}`}
              x1={startPt.x}
              y1={startPt.y}
              x2={endPt.x}
              y2={endPt.y}
              stroke={PALETTE.border}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.6}
            />
          );
        })}

        {/* Nodes as cards */}
        {NODES.map((node) => {
          const { cx, cy } = getCardCenter(node);
          const strokeColour = node.isThesis ? PALETTE.teal : PALETTE.imperial;
          const numX = cx + cardW / 2 - 18;
          const numY = cy - cardH / 2 + 18;
          const num = NODE_NUMBER[node.id];

          return (
            <g key={node.id}>
              {node.isThesis && (
                <rect
                  x={cx - cardW / 2 - 8} y={cy - cardH / 2 - 8}
                  width={cardW + 16} height={cardH + 16}
                  rx={18}
                  fill="none"
                  stroke={PALETTE.teal}
                  strokeWidth={3}
                  opacity={0.7}
                  filter="url(#pm-glow)"
                />
              )}
              <rect
                x={cx - cardW / 2} y={cy - cardH / 2}
                width={cardW} height={cardH}
                rx={12}
                fill={PALETTE.white}
                stroke={strokeColour}
                strokeWidth={node.isThesis ? 3 : 2}
              />
              {/* Circled number / star */}
              <circle cx={numX} cy={numY} r={12} fill={strokeColour} fillOpacity={0.12} stroke={strokeColour} strokeWidth={1.5} />
              <text
                x={numX}
                y={numY}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize={num === '★' ? '14' : '13'}
                fontWeight={700}
                fill={strokeColour}
              >
                {num}
              </text>
              <text
                x={cx}
                y={cy - 20}
                textAnchor="middle"
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize="22"
                fontWeight={700}
                fill={node.isThesis ? PALETTE.teal : PALETTE.navy}
              >
                {node.label}
              </text>
              <text
                x={cx}
                y={cy + 6}
                textAnchor="middle"
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize="18"
                fill={PALETTE.slate}
              >
                {node.citation}
              </text>
              <text
                x={cx}
                y={cy + 30}
                textAnchor="middle"
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize="15"
                fontStyle="italic"
                fill={node.isThesis ? PALETTE.teal : PALETTE.purple}
              >
                {node.detail}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
    </SlideShell>
  );
}
