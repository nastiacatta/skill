/**
 * Perceptually uniform colour scale functions.
 *
 * Provides viridis, cividis, and sequentialBlue colour scales for heatmaps
 * and continuous data visualisation. Each scale maps a normalised value
 * t ∈ [0, 1] to an RGB triple.
 *
 * Viridis and cividis lookup tables are sampled from the matplotlib
 * reference implementation (17 evenly-spaced stops from t = 0 to t = 1).
 * Intermediate values are linearly interpolated between adjacent stops.
 *
 * sequentialBlue interpolates from white (#f7fbff) to dark blue (#08306b)
 * with perceptually uniform lightness steps using a multi-stop lookup table.
 */

/** RGB triple with integer channels in [0, 255]. */
export type RGB = [number, number, number];

// ── Viridis lookup table (17 stops, sampled from matplotlib viridis) ────

const VIRIDIS_STOPS: RGB[] = [
  [68, 1, 84],     // t = 0.000
  [72, 20, 103],   // t = 0.0625
  [72, 38, 119],   // t = 0.125
  [65, 55, 130],   // t = 0.1875
  [57, 72, 135],   // t = 0.250
  [48, 87, 138],   // t = 0.3125
  [40, 101, 137],  // t = 0.375
  [33, 115, 133],  // t = 0.4375
  [30, 129, 126],  // t = 0.500
  [34, 143, 115],  // t = 0.5625
  [53, 156, 101],  // t = 0.625
  [80, 168, 84],   // t = 0.6875
  [115, 179, 63],  // t = 0.750
  [157, 189, 43],  // t = 0.8125
  [199, 196, 32],  // t = 0.875
  [234, 205, 42],  // t = 0.9375
  [253, 231, 37],  // t = 1.000
];

// ── Cividis lookup table (17 stops, sampled from matplotlib cividis) ────

const CIVIDIS_STOPS: RGB[] = [
  [0, 32, 77],     // t = 0.000
  [0, 42, 102],    // t = 0.0625
  [0, 52, 110],    // t = 0.125
  [39, 63, 108],   // t = 0.1875
  [60, 74, 107],   // t = 0.250
  [77, 85, 108],   // t = 0.3125
  [91, 96, 110],   // t = 0.375
  [105, 108, 112], // t = 0.4375
  [120, 119, 113], // t = 0.500
  [136, 130, 108], // t = 0.5625
  [153, 142, 98],  // t = 0.625
  [170, 153, 85],  // t = 0.6875
  [188, 164, 68],  // t = 0.750
  [206, 176, 44],  // t = 0.8125
  [223, 189, 7],   // t = 0.875
  [238, 203, 22],  // t = 0.9375
  [253, 219, 36],  // t = 1.000
];

// ── Sequential blue lookup table (17 stops, white → dark blue) ──────────
// Sampled from ColorBrewer Blues 9-class scale extended to 17 stops
// for perceptually uniform lightness progression.

const SEQUENTIAL_BLUE_STOPS: RGB[] = [
  [247, 251, 255], // t = 0.000  #f7fbff (white)
  [232, 241, 250], // t = 0.0625
  [218, 231, 245], // t = 0.125
  [199, 220, 239], // t = 0.1875
  [179, 208, 232], // t = 0.250
  [158, 196, 224], // t = 0.3125
  [136, 182, 215], // t = 0.375
  [114, 168, 207], // t = 0.4375
  [90, 152, 198],  // t = 0.500
  [70, 137, 189],  // t = 0.5625
  [50, 120, 178],  // t = 0.625
  [35, 103, 167],  // t = 0.6875
  [24, 87, 154],   // t = 0.750
  [16, 72, 139],   // t = 0.8125
  [11, 58, 124],   // t = 0.875
  [9, 45, 108],    // t = 0.9375
  [8, 48, 107],    // t = 1.000  #08306b (dark blue)
];

// ── Internal helpers ────────────────────────────────────────────────────

/** Clamp a number to [lo, hi]. */
function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/**
 * Linearly interpolate between stops in a lookup table.
 * Input t is clamped to [0, 1] before interpolation.
 */
function interpolateStops(t: number, stops: RGB[]): RGB {
  const tc = clamp(t, 0, 1);
  const n = stops.length - 1; // number of segments
  const scaled = tc * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  const frac = scaled - i;

  const [r0, g0, b0] = stops[i];
  const [r1, g1, b1] = stops[i + 1];

  return [
    Math.round(r0 + frac * (r1 - r0)),
    Math.round(g0 + frac * (g1 - g0)),
    Math.round(b0 + frac * (b1 - b0)),
  ];
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Viridis perceptually uniform colour scale.
 * @param t Normalised value in [0, 1] (clamped if outside range).
 * @returns RGB triple with integer channels in [0, 255].
 */
export function viridis(t: number): RGB {
  return interpolateStops(t, VIRIDIS_STOPS);
}

/**
 * Cividis perceptually uniform colour scale.
 * @param t Normalised value in [0, 1] (clamped if outside range).
 * @returns RGB triple with integer channels in [0, 255].
 */
export function cividis(t: number): RGB {
  return interpolateStops(t, CIVIDIS_STOPS);
}

/**
 * Single-hue sequential blue scale with perceptually uniform lightness.
 * Interpolates from white (#f7fbff) to dark blue (#08306b).
 * @param t Normalised value in [0, 1] (clamped if outside range).
 * @returns RGB triple with integer channels in [0, 255].
 */
export function sequentialBlue(t: number): RGB {
  return interpolateStops(t, SEQUENTIAL_BLUE_STOPS);
}

/**
 * Convert an RGB triple to a CSS `rgb(r, g, b)` string.
 */
export function rgbToCSS(rgb: RGB): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Map a numeric value to a CSS colour string using a colour scale.
 *
 * The value is normalised to [0, 1] based on the given min/max bounds,
 * then passed through the scale function. If min === max, returns the
 * colour at t = 0.5.
 *
 * @param value  The data value to map.
 * @param min    The minimum of the data range.
 * @param max    The maximum of the data range.
 * @param scale  A colour scale function (e.g. viridis, cividis, sequentialBlue).
 * @returns CSS `rgb(r, g, b)` string.
 */
export function scaleToColour(
  value: number,
  min: number,
  max: number,
  scale: (t: number) => RGB,
): string {
  const t = min === max ? 0.5 : clamp((value - min) / (max - min), 0, 1);
  return rgbToCSS(scale(t));
}
