// Colour grading for Vice Panels: every grade is a gradient map (a ramp from shadow colour to highlight
// colour, looked up by each pixel's luminance) blended over a contrast-and-saturation pass. The ramp is
// precomputed into a 256-entry table per grade, so grading a whole photo is one arithmetic pass over its
// pixels, and the graded photo is cached and reused for every panel that shows it.

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// A gradient ramp: stops are [position 0..1, '#rrggbb']; returns three 256-entry channel tables.
function buildRamp(stops) {
  const pts = stops.map(([at, hex]) => [at, hexToRgb(hex)]).sort((a, b) => a[0] - b[0]);
  const tables = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let i = 0;
    while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
    const [aAt, aRgb] = pts[i];
    const [bAt, bRgb] = pts[i + 1];
    const f = Math.min(1, Math.max(0, (t - aAt) / (bAt - aAt || 1)));
    for (let c = 0; c < 3; c++) tables[c][v] = Math.round(aRgb[c] + (bRgb[c] - aRgb[c]) * f);
  }
  return tables;
}

// The four grades. `amount` is how much of the gradient map replaces the photo's own colours; the rest is
// the photo after the contrast/saturation pass, so a grade tints hard without flattening detail.
export const GRADES = {
  sunset: {
    label: 'Sunset Vice',
    stops: [[0, '#180a30'], [0.32, '#6e1e5a'], [0.58, '#e8483f'], [0.8, '#ff8c42'], [1, '#ffd98a']],
    amount: 0.52, saturation: 1.18, contrast: 1.07,
  },
  neon: {
    label: 'Neon Night',
    stops: [[0, '#050914'], [0.3, '#123a7d'], [0.55, '#7b2ff7'], [0.78, '#ff2e88'], [1, '#7df9ff']],
    amount: 0.5, saturation: 1.34, contrast: 1.13,
  },
  golden: {
    label: 'Golden Hour',
    stops: [[0, '#1c0f04'], [0.38, '#7a4416'], [0.68, '#d98e32'], [1, '#ffedb5']],
    amount: 0.48, saturation: 1.1, contrast: 1.0,
  },
  noir: {
    label: 'Noir Palm',
    stops: [[0, '#05070a'], [0.45, '#274b52'], [0.75, '#8fa8a0'], [1, '#e8f0e6']],
    amount: 0.58, saturation: 0.55, contrast: 1.24,
  },
};

const rampCache = new Map();

export function rampFor(gradeName) {
  if (!rampCache.has(gradeName)) rampCache.set(gradeName, buildRamp(GRADES[gradeName].stops));
  return rampCache.get(gradeName);
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// Grade a canvas in place: contrast, then saturation around each pixel's luminance, then blend the
// gradient map (looked up by that luminance) over the result by `amount` (the grade's own amount scaled
// by amountScale, which the renderer varies per panel for the collage rhythm).
export function gradeCanvas(canvas, gradeName, amountScale = 1) {
  const grade = GRADES[gradeName];
  const ramp = rampFor(gradeName);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  const amount = Math.min(0.85, grade.amount * amountScale);
  const keep = 1 - amount;
  const { saturation: sat, contrast } = grade;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    r = clamp255(((r / 255 - 0.5) * contrast + 0.5) * 255);
    g = clamp255(((g / 255 - 0.5) * contrast + 0.5) * 255);
    b = clamp255(((b / 255 - 0.5) * contrast + 0.5) * 255);
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    r = clamp255(lum + (r - lum) * sat);
    g = clamp255(lum + (g - lum) * sat);
    b = clamp255(lum + (b - lum) * sat);
    px[i] = r * keep + ramp[0][lum] * amount;
    px[i + 1] = g * keep + ramp[1][lum] * amount;
    px[i + 2] = b * keep + ramp[2][lum] * amount;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
