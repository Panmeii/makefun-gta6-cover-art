// The cover renderer: draws a whole cover onto any 2D context at any size, so the editor preview and the
// exported PNG are the same drawing at different resolutions. Each panel's photo is colour-graded once
// (cached), then drawn cover-fit with the panel's focus, zoom and pan; panels are separated by the pale
// keylines of the genre, a scrim is laid where the lettering will sit, and grain and a vignette finish
// the print before the title and tagline are drawn on top.

import { gradeCanvas } from './grade.js';
import { panelsFor, LAYOUTS } from './layouts.js';
import { drawPosterTitle, drawTagline, titleMetrics, TITLE_PALETTES } from './lettering.js';

const gradedCache = new Map();

// A photo run through a grade. variant 1 pushes the gradient map harder, so neighbouring panels of one
// photo do not read as one flat tint — the collage rhythm of a real multi-panel cover.
export function gradedPhoto(photo, gradeName, variant) {
  const key = `${photo.id}|${gradeName}|${variant}`;
  if (gradedCache.has(key)) return gradedCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = photo.img.naturalWidth;
  canvas.height = photo.img.naturalHeight;
  canvas.getContext('2d').drawImage(photo.img, 0, 0);
  gradeCanvas(canvas, gradeName, variant === 1 ? 1.32 : 0.88);
  gradedCache.set(key, canvas);
  return canvas;
}

export function forgetPhoto(photo) {
  for (const key of [...gradedCache.keys()]) if (key.startsWith(`${photo.id}|`)) gradedCache.delete(key);
}

function panelPath(ctx, panel) {
  ctx.beginPath();
  if (panel.poly) {
    panel.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  } else {
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
  }
}

function drawPanelPhoto(ctx, panel, transform, state) {
  const photo = state.photos[transform.photo];
  if (!photo) return;
  const img = gradedPhoto(photo, state.grade, panel.variant);
  const scale = Math.max(panel.w / img.width, panel.h / img.height) * transform.zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  let dx = panel.x + panel.w / 2 - transform.fx * dw + transform.panX * Math.max(0, dw - panel.w);
  let dy = panel.y + panel.h / 2 - transform.fy * dh + transform.panY * Math.max(0, dh - panel.h);
  dx = Math.min(panel.x, Math.max(panel.x + panel.w - dw, dx));
  dy = Math.min(panel.y, Math.max(panel.y + panel.h - dh, dy));
  ctx.save();
  panelPath(ctx, panel);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawKeylines(ctx, panels, W) {
  ctx.save();
  ctx.strokeStyle = '#f7f1de';
  ctx.lineWidth = Math.max(3, W * 0.0058);
  ctx.lineJoin = 'round';
  for (const panel of panels) {
    panelPath(ctx, panel);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScrim(ctx, W, H, zone) {
  ctx.save();
  if (zone === 'strip') {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.34);
    g.addColorStop(0, 'rgba(16,3,26,0.36)');
    g.addColorStop(1, 'rgba(16,3,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.34);
  }
  if (zone === 'top' || zone === 'top-left') {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.46);
    g.addColorStop(0, 'rgba(8,2,18,0.58)');
    g.addColorStop(1, 'rgba(8,2,18,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.46);
  }
  if (zone === 'top-left') {
    const g = ctx.createLinearGradient(0, 0, W * 0.72, 0);
    g.addColorStop(0, 'rgba(8,2,18,0.34)');
    g.addColorStop(1, 'rgba(8,2,18,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * 0.72, H);
  }
  if (zone === 'bottom') {
    const g = ctx.createLinearGradient(0, H, 0, H * 0.5);
    g.addColorStop(0, 'rgba(8,2,18,0.68)');
    g.addColorStop(1, 'rgba(8,2,18,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
  }
  ctx.restore();
}

let grainTile = null;
function drawGrain(ctx, W, H) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 240;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(240, 240);
    let seed = 20261119;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = 96 + (seed % 128);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const r0 = Math.min(W, H) * 0.42;
  const r1 = Math.max(W, H) * 0.8;
  const g = ctx.createRadialGradient(W / 2, H * 0.46, r0, W / 2, H * 0.46, r1);
  g.addColorStop(0, 'rgba(12,0,24,0)');
  g.addColorStop(1, 'rgba(12,0,24,0.4)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawLettering(ctx, W, H, state) {
  const zone = LAYOUTS[state.layout].titleZone;
  const palette = TITLE_PALETTES[state.grade];
  const tagSize = Math.max(13, H * 0.024);
  const tagColor = '#ffe9c9';
  if (zone === 'strip') {
    drawTagline(ctx, { text: state.tagline, cx: W / 2, y: H * 0.052, size: tagSize, color: tagColor, ruleColor: '#ff8c42' });
    drawPosterTitle(ctx, {
      text: state.title, cx: W / 2, top: H * 0.082,
      maxWidth: W * 0.95, maxHeight: H * 0.225, palette,
    });
  } else if (zone === 'top-left') {
    const used = drawPosterTitle(ctx, {
      text: state.title, cx: W * 0.05, top: H * 0.04,
      maxWidth: W * 0.64, maxHeight: H * 0.33, palette, align: 'left',
    });
    drawTagline(ctx, {
      text: state.tagline, cx: W * 0.05 + W * 0.29, y: H * 0.04 + used + tagSize * 1.15,
      size: tagSize, color: tagColor, ruleColor: '#ff2e88',
    });
  } else if (zone === 'top') {
    drawTagline(ctx, { text: state.tagline, cx: W / 2, y: H * 0.045, size: tagSize, color: tagColor, ruleColor: '#ff8c42' });
    drawPosterTitle(ctx, {
      text: state.title, cx: W / 2, top: H * 0.075,
      maxWidth: W * 0.92, maxHeight: H * 0.24, palette,
    });
  } else {
    // bottom: measure first so the block's foot sits a margin above the cover's foot, tagline above it
    const m = titleMetrics(ctx, state.title, W * 0.94, H * 0.26);
    const foot = H * 0.965;
    drawTagline(ctx, {
      text: state.tagline, cx: W / 2, y: foot - m.height - tagSize * 1.05,
      size: tagSize, color: tagColor, ruleColor: '#ff8c42',
    });
    drawPosterTitle(ctx, {
      text: state.title, cx: W / 2, top: foot - m.height,
      maxWidth: W * 0.94, maxHeight: H * 0.26, palette,
    });
  }
}

// Draws the whole cover. `selection` (an editor-only panel index) outlines that panel; exports pass -1.
export function renderCover(ctx, W, H, state, selection = -1) {
  ctx.save();
  ctx.fillStyle = '#0d0714';
  ctx.fillRect(0, 0, W, H);
  const panels = panelsFor(state.layout, W, H);
  panels.forEach((panel, i) => {
    panel.variant = i % 2;
    const transform = state.panels[i];
    if (transform) drawPanelPhoto(ctx, panel, transform, state);
  });
  drawKeylines(ctx, panels, W);
  drawScrim(ctx, W, H, LAYOUTS[state.layout].titleZone);
  drawGrain(ctx, W, H);
  drawVignette(ctx, W, H);
  drawLettering(ctx, W, H, state);
  if (selection >= 0 && panels[selection]) {
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.setLineDash([W * 0.012, W * 0.008]);
    panelPath(ctx, panels[selection]);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function renderToCanvas(state, w, h, selection = -1) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), w, h, state, selection);
  return canvas;
}
