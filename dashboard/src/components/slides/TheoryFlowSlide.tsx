import { PALETTE, TYPOGRAPHY } from './shared/presentationConstants';

/**
 * Slide 2: "What Is a Prediction Market?" — SVG diagram showing the three
 * roles explicitly, so the slide reinforces the story we tell verbally.
 *
 * Layout (left to right):
 *   Client (posts task + reward)
 *      ↓ (arrow labelled "task")
 *   Forecasters (each submits forecast + wager)
 *      ↓ (arrows labelled "forecast + wager")
 *   Platform (aggregates + settles)
 *      ↓ (arrow labelled "market forecast + payoffs")
 *   Outcome / reward allocation
 *
 * No formulas. No technical notation. The visual answers "who does what?".
 */
export default function TheoryFlowSlide() {
  // Layout constants
  const clientX = 30;
  const clientW = 200;
  const clientH = 110;
  const clientCY = 280;

  const forecastersX = 300;
  const forecasterW = 180;
  const forecasterH = 80;

  const platformX = 560;
  const platformW = 230;
  const platformH = 140;
  const platformCY = 280;

  const outputX = 840;
  const outputW = 180;
  const outputH = 110;
  const outputCY = 280;

  const forecasters = [
    { label: 'Forecaster A', y: 110 },
    { label: 'Forecaster B', y: 240 },
    { label: 'Forecaster C', y: 370 },
  ];

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
        viewBox="0 0 1060 560"
        style={{ width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Prediction market diagram: a client posts a task, forecasters submit forecasts with wagers, the platform aggregates and settles, and payoffs flow back after the outcome is observed"
      >
        <defs>
          <marker
            id="pm-arrow-grey"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={PALETTE.slate} />
          </marker>
          <marker
            id="pm-arrow-teal"
            markerWidth="12"
            markerHeight="8"
            refX="12"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 12 4, 0 8" fill={PALETTE.teal} />
          </marker>
        </defs>

        {/* ── Client box ── */}
        <rect
          x={clientX}
          y={clientCY - clientH / 2}
          width={clientW}
          height={clientH}
          rx={14}
          fill={PALETTE.lightBg}
          stroke={PALETTE.imperial}
          strokeWidth={2.5}
        />
        <text
          x={clientX + clientW / 2}
          y={clientCY - 14}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="22"
          fontWeight={700}
          fill={PALETTE.imperial}
        >
          Client
        </text>
        <text
          x={clientX + clientW / 2}
          y={clientCY + 10}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="15"
          fill={PALETTE.slate}
        >
          Needs a forecast
        </text>
        <text
          x={clientX + clientW / 2}
          y={clientCY + 30}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="15"
          fill={PALETTE.slate}
        >
          Posts a reward
        </text>

        {/* Arrow: Client → Forecasters (label: task) */}
        <line
          x1={clientX + clientW + 6}
          y1={clientCY}
          x2={forecastersX - 6}
          y2={clientCY}
          stroke={PALETTE.slate}
          strokeWidth={2.5}
          markerEnd="url(#pm-arrow-grey)"
        />
        <text
          x={(clientX + clientW + forecastersX) / 2}
          y={clientCY - 10}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="14"
          fontStyle="italic"
          fill={PALETTE.slate}
        >
          task + reward
        </text>

        {/* ── Forecaster stack ── */}
        {forecasters.map((f) => {
          const centerY = f.y + forecasterH / 2;
          return (
            <g key={f.label}>
              <rect
                x={forecastersX}
                y={f.y}
                width={forecasterW}
                height={forecasterH}
                rx={12}
                fill={PALETTE.white}
                stroke={PALETTE.navy}
                strokeWidth={2}
              />
              <text
                x={forecastersX + forecasterW / 2}
                y={f.y + 28}
                textAnchor="middle"
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize="17"
                fontWeight={600}
                fill={PALETTE.navy}
              >
                {f.label}
              </text>
              {/* Forecast + wager token */}
              <g transform={`translate(${forecastersX + 14}, ${f.y + 44})`}>
                <circle cx="7" cy="7" r="7" fill={PALETTE.coral} opacity="0.22" />
                <text
                  x="7" y="11"
                  textAnchor="middle"
                  fontFamily={TYPOGRAPHY.fontFamily}
                  fontSize="11"
                  fontWeight={700}
                  fill={PALETTE.coral}
                >
                  $
                </text>
              </g>
              <text
                x={forecastersX + 32}
                y={f.y + 57}
                fontFamily={TYPOGRAPHY.fontFamily}
                fontSize="14"
                fill={PALETTE.slate}
              >
                forecast + wager
              </text>

              {/* Arrow: each forecaster → Platform */}
              <line
                x1={forecastersX + forecasterW + 6}
                y1={centerY}
                x2={platformX - 6}
                y2={platformCY - 40 + (forecasters.indexOf(f) * 40)}
                stroke={PALETTE.slate}
                strokeWidth={2}
                markerEnd="url(#pm-arrow-grey)"
              />
            </g>
          );
        })}

        {/* ── Platform box ── */}
        <rect
          x={platformX}
          y={platformCY - platformH / 2}
          width={platformW}
          height={platformH}
          rx={14}
          fill={PALETTE.white}
          stroke={PALETTE.teal}
          strokeWidth={3}
        />
        <text
          x={platformX + platformW / 2}
          y={platformCY - 32}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="22"
          fontWeight={700}
          fill={PALETTE.teal}
        >
          Platform
        </text>
        {/* three merging circles */}
        <g transform={`translate(${platformX + platformW / 2}, ${platformCY - 4})`}>
          <circle cx="-12" cy="0" r="9" fill={PALETTE.teal} opacity="0.18" />
          <circle cx="0" cy="0" r="9" fill={PALETTE.teal} opacity="0.30" />
          <circle cx="12" cy="0" r="9" fill={PALETTE.teal} opacity="0.45" />
        </g>
        <text
          x={platformX + platformW / 2}
          y={platformCY + 26}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="15"
          fill={PALETTE.slate}
        >
          Aggregates + settles
        </text>
        <text
          x={platformX + platformW / 2}
          y={platformCY + 46}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="15"
          fill={PALETTE.slate}
        >
          Redistributes wagers
        </text>

        {/* Arrow: Platform → output */}
        <line
          x1={platformX + platformW + 6}
          y1={platformCY}
          x2={outputX - 6}
          y2={outputCY}
          stroke={PALETTE.teal}
          strokeWidth={3}
          markerEnd="url(#pm-arrow-teal)"
        />
        <text
          x={(platformX + platformW + outputX) / 2}
          y={outputCY - 10}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="14"
          fontStyle="italic"
          fill={PALETTE.teal}
        >
          market forecast
        </text>

        {/* ── Output / reward delivery ── */}
        <rect
          x={outputX}
          y={outputCY - outputH / 2}
          width={outputW}
          height={outputH}
          rx={14}
          fill={PALETTE.teal}
          stroke={PALETTE.teal}
          strokeWidth={2}
        />
        <text
          x={outputX + outputW / 2}
          y={outputCY - 10}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="19"
          fontWeight={700}
          fill={PALETTE.white}
        >
          Market
        </text>
        <text
          x={outputX + outputW / 2}
          y={outputCY + 12}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="19"
          fontWeight={700}
          fill={PALETTE.white}
        >
          forecast
        </text>
        <text
          x={outputX + outputW / 2}
          y={outputCY + 34}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="13"
          fill={PALETTE.darkText}
        >
          (+ payoffs after outcome)
        </text>

        {/* Role labels underneath */}
        <text
          x={clientX + clientW / 2}
          y={510}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="16"
          fontWeight={600}
          fill={PALETTE.navy}
        >
          Client
        </text>
        <text
          x={forecastersX + forecasterW / 2}
          y={510}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="16"
          fontWeight={600}
          fill={PALETTE.navy}
        >
          Forecasters
        </text>
        <text
          x={platformX + platformW / 2}
          y={510}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="16"
          fontWeight={600}
          fill={PALETTE.navy}
        >
          Platform
        </text>
        <text
          x={outputX + outputW / 2}
          y={510}
          textAnchor="middle"
          fontFamily={TYPOGRAPHY.fontFamily}
          fontSize="16"
          fontWeight={600}
          fill={PALETTE.navy}
        >
          Output
        </text>
      </svg>
    </div>
  );
}
