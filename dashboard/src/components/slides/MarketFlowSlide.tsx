import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

/**
 * Slide 3 right panel: "Why combine forecasts?"
 *
 * Visual answer: three individual forecaster densities (each with a
 * different bias / spread) funnel into a single combined market density
 * that is narrower and better centred on the truth line.
 *
 * This is a pure-SVG sketch, not real data. The goal is to let the
 * audience see combination happening, rather than read about it.
 */
export default function MarketFlowSlide() {
  // Canvas
  const W = 520;
  const H = 540;

  // Plot area for the three individual densities (left)
  const leftX = 40;
  const leftY = 40;
  const leftW = 230;
  const leftH = 400;

  // Plot area for the combined density (right)
  const rightX = 340;
  const rightY = 120;
  const rightW = 160;
  const rightH = 240;

  // Three forecaster densities — different means and spreads
  const forecasters = [
    { label: 'A', mean: 0.35, sd: 0.13, colour: PALETTE.imperial,  weight: 0.9 },
    { label: 'B', mean: 0.55, sd: 0.18, colour: PALETTE.coral,     weight: 0.6 },
    { label: 'C', mean: 0.48, sd: 0.10, colour: PALETTE.purple,    weight: 1.0 },
  ];

  // Combined (wager-weighted) density — narrower, centred near weighted mean
  const wSum = forecasters.reduce((s, f) => s + f.weight, 0);
  const combinedMean =
    forecasters.reduce((s, f) => s + f.mean * f.weight, 0) / wSum;
  const combinedSd = 0.07;

  // True outcome line (sits where a reasonable "ground truth" would)
  const truth = 0.5;

  // Utility: Gaussian density, then a path for the given plot rect
  function densityPath(
    mean: number,
    sd: number,
    x: number,
    y: number,
    w: number,
    h: number,
    peak: number
  ) {
    const steps = 60;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;                       // 0..1 across x
      const px = x + t * w;
      const pdf = Math.exp(-0.5 * ((t - mean) / sd) ** 2);
      const py = y + h - pdf * peak;
      pts.push([px, py]);
    }
    const d =
      `M ${x} ${y + h} ` +
      pts.map(([px, py]) => `L ${px} ${py}`).join(' ') +
      ` L ${x + w} ${y + h} Z`;
    return d;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Three individual forecast densities combine into a single, narrower market density centred on the true outcome"
      >
        <defs>
          <marker
            id="combine-arrow"
            markerWidth="12"
            markerHeight="8"
            refX="12"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 12 4, 0 8" fill={PALETTE.teal} />
          </marker>
        </defs>

        {/* ── Left panel: three forecaster densities, stacked ── */}
        <text
          x={leftX + leftW / 2}
          y={leftY - 12}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="18"
          fontWeight={700}
          fill={PALETTE.navy}
        >
          Individual forecasts
        </text>

        {forecasters.map((f, i) => {
          const rowH = leftH / 3;
          const rowY = leftY + i * rowH;
          const peak = rowH - 18;
          return (
            <g key={f.label}>
              {/* row baseline */}
              <line
                x1={leftX}
                x2={leftX + leftW}
                y1={rowY + rowH - 4}
                y2={rowY + rowH - 4}
                stroke={PALETTE.border}
                strokeWidth={1}
              />
              {/* density */}
              <path
                d={densityPath(f.mean, f.sd, leftX, rowY + 10, leftW, peak, peak * 0.95)}
                fill={f.colour}
                fillOpacity={0.22}
                stroke={f.colour}
                strokeWidth={2}
              />
              {/* forecaster label */}
              <text
                x={leftX - 10}
                y={rowY + rowH / 2 + 4}
                textAnchor="end"
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize="15"
                fontWeight={700}
                fill={f.colour}
              >
                {f.label}
              </text>
            </g>
          );
        })}

        {/* truth line on the left panel */}
        <line
          x1={leftX + truth * leftW}
          x2={leftX + truth * leftW}
          y1={leftY + 4}
          y2={leftY + leftH - 4}
          stroke={PALETTE.slate}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={leftX + truth * leftW + 4}
          y={leftY - 2}
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="12"
          fill={PALETTE.slate}
        >
          truth
        </text>

        {/* ── Arrow funnel: three lines converging ── */}
        {forecasters.map((f, i) => {
          const rowH = leftH / 3;
          const rowY = leftY + i * rowH;
          const startX = leftX + leftW + 4;
          const startY = rowY + rowH / 2;
          const endX = rightX - 6;
          const endY = rightY + rightH / 2;
          return (
            <line
              key={`arr-${f.label}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={PALETTE.teal}
              strokeWidth={2}
              opacity={0.55}
              markerEnd={i === 1 ? 'url(#combine-arrow)' : undefined}
            />
          );
        })}

        <text
          x={(leftX + leftW + rightX) / 2}
          y={rightY + rightH / 2 - 16}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="13"
          fontStyle="italic"
          fill={PALETTE.teal}
        >
          weighted
        </text>
        <text
          x={(leftX + leftW + rightX) / 2}
          y={rightY + rightH / 2}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="13"
          fontStyle="italic"
          fill={PALETTE.teal}
        >
          combination
        </text>

        {/* ── Right panel: combined density ── */}
        <text
          x={rightX + rightW / 2}
          y={rightY - 12}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="18"
          fontWeight={700}
          fill={PALETTE.teal}
        >
          Market forecast
        </text>

        {/* combined density baseline */}
        <line
          x1={rightX}
          x2={rightX + rightW}
          y1={rightY + rightH - 4}
          y2={rightY + rightH - 4}
          stroke={PALETTE.border}
          strokeWidth={1}
        />
        <path
          d={densityPath(
            combinedMean,
            combinedSd,
            rightX,
            rightY + 10,
            rightW,
            rightH - 14,
            (rightH - 14) * 0.95
          )}
          fill={PALETTE.teal}
          fillOpacity={0.32}
          stroke={PALETTE.teal}
          strokeWidth={2.5}
        />
        {/* truth line on combined panel */}
        <line
          x1={rightX + truth * rightW}
          x2={rightX + truth * rightW}
          y1={rightY + 4}
          y2={rightY + rightH - 4}
          stroke={PALETTE.slate}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={rightX + truth * rightW + 4}
          y={rightY - 2}
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="12"
          fill={PALETTE.slate}
        >
          truth
        </text>

        {/* Caption under combined density */}
        <text
          x={rightX + rightW / 2}
          y={rightY + rightH + 28}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="14"
          fontWeight={600}
          fill={PALETTE.navy}
        >
          narrower &amp; better-centred
        </text>
        <text
          x={rightX + rightW / 2}
          y={rightY + rightH + 48}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="13"
          fill={PALETTE.slate}
        >
          than any single forecaster
        </text>
      </svg>
    </div>
  );
}
