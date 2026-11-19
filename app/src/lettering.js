// Poster lettering: the title is stacked one or two words to a line in a heavy condensed sans, drawn in
// layers — a hard offset shadow, a thick dark outline, then a vertical gradient fill in the grade's own
// colours, with a neon glow pass on the Neon Night grade. The tagline is a letterspaced kicker with a
// rule on each side. All of it is drawn with system fonts; nothing is a font file of anyone's game.

export const TITLE_FONT =
  `'Noto Sans Condensed','Archivo Narrow','Arial Narrow','Liberation Sans Narrow',Impact,sans-serif`;

const SQUEEZE = 0.94; // a slight horizontal squeeze keeps even a wide fallback face poster-narrow

export const TITLE_PALETTES = {
  sunset: { stops: ['#fff6d8', '#ffc46b', '#ff7a59', '#ff4e7a'], ink: '#2a0a2e', shadow: '#1c0626', glow: null },
  neon: { stops: ['#eaffff', '#8ff7ff', '#38b6ff', '#ff4ecd'], ink: '#12042e', shadow: '#0a0630', glow: '#ff2fb3' },
  golden: { stops: ['#fffbe6', '#ffe08a', '#ffb347', '#ff7847'], ink: '#33150a', shadow: '#220d04', glow: null },
  noir: { stops: ['#f7faf5', '#cfe0d4', '#8fb3a4', '#51796c'], ink: '#0a1f18', shadow: '#04140f', glow: null },
};

// One word a line for a two-word title ("SUNSET" / "HEIST"); longer titles split into the two most
// balanced lines.
export function splitTitleLines(text) {
  const words = String(text || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return ['VICE', 'PANELS'];
  if (words.length <= 2) return words;
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const score = Math.abs(lines[0].length - lines[1].length);
    if (!best || score < best.score) best = { score, lines };
  }
  return best.lines;
}

function fitFontPx(ctx, lines, maxWidth, maxHeight) {
  let px = Math.max(24, Math.min(maxWidth * 0.9, (maxHeight / lines.length) * 1.5));
  for (; px > 12; px -= 2) {
    ctx.font = `900 ${px}px ${TITLE_FONT}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width)) * SQUEEZE;
    if (widest <= maxWidth && lines.length * px * 0.96 <= maxHeight) break;
  }
  return px;
}

// The size a title block will take at the given limits, for layouts that anchor it by its foot.
export function titleMetrics(ctx, text, maxWidth, maxHeight) {
  const lines = splitTitleLines(text);
  const px = fitFontPx(ctx, lines, maxWidth, maxHeight);
  return { lines, px, height: lines.length * px * 0.96 };
}

// Draws the title with its top at `top`; returns the height it took. align 'center' centres on cx,
// 'left' starts at cx.
export function drawPosterTitle(ctx, { text, cx, top, maxWidth, maxHeight, palette, align = 'center' }) {
  const lines = splitTitleLines(text);
  const px = fitFontPx(ctx, lines, maxWidth, maxHeight);
  const lineHeight = px * 0.96;
  ctx.save();
  ctx.font = `900 ${px}px ${TITLE_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const anchorX = align === 'center' ? cx : cx;
  lines.forEach((line, i) => {
    const baseline = top + px * 0.82 + i * lineHeight;
    ctx.save();
    ctx.translate(anchorX, 0);
    ctx.scale(SQUEEZE, 1);
    const x = 0;
    if (palette.glow) {
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = px * 0.32;
      ctx.fillStyle = palette.glow;
      ctx.fillText(line, x, baseline);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = palette.shadow;
    ctx.fillText(line, x + px * 0.028, baseline + px * 0.045);
    ctx.fillText(line, x + px * 0.055, baseline + px * 0.085);
    ctx.lineJoin = 'round';
    ctx.lineWidth = px * 0.15;
    ctx.strokeStyle = palette.ink;
    ctx.strokeText(line, x, baseline);
    const grad = ctx.createLinearGradient(0, baseline - px * 0.82, 0, baseline + px * 0.12);
    palette.stops.forEach((stop, j) => grad.addColorStop(j / (palette.stops.length - 1), stop));
    ctx.fillStyle = grad;
    ctx.fillText(line, x, baseline);
    ctx.restore();
  });
  ctx.restore();
  return lines.length * lineHeight;
}

// A letterspaced small-caps kicker, centred on cx, with a short rule each side.
export function drawTagline(ctx, { text, cx, y, size, color, ruleColor }) {
  const words = String(text || '').trim().toUpperCase();
  if (!words) return;
  ctx.save();
  ctx.font = `700 ${size}px ${TITLE_FONT}`;
  const spacing = size * 0.42;
  const widths = [...words].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (words.length - 1);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  let x = cx - total / 2;
  [...words].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  const ruleLen = size * 2.4;
  const gap = size * 0.9;
  ctx.strokeStyle = ruleColor;
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.beginPath();
  ctx.moveTo(cx - total / 2 - gap - ruleLen, y);
  ctx.lineTo(cx - total / 2 - gap, y);
  ctx.moveTo(cx + total / 2 + gap, y);
  ctx.lineTo(cx + total / 2 + gap + ruleLen, y);
  ctx.stroke();
  ctx.restore();
}
