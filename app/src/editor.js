// The editor: owns the studio state (photos, layout, grade, words, per-panel crops), wires the sidebar
// controls, and turns pointer gestures on the preview into panel selection, pans and zooms. The preview
// and every export are the same render at different sizes (render.js), so what you frame is what you get.

import { panelsFor, panelAt, LAYOUTS } from './layouts.js';
import { GRADES } from './grade.js';
import { renderCover, renderToCanvas } from './render.js';

export const POST_SIZES = [
  [1080, 1080],
  [1080, 1350],
  [1080, 1920],
  [1920, 1080],
];

const $ = (id) => document.getElementById(id);

export function createStudio() {
  const canvas = $('cover');
  const ctx = canvas.getContext('2d');
  const state = {
    photos: [],
    nextPhotoId: 1,
    layout: 'masthead',
    grade: 'sunset',
    title: 'Sunset Heist',
    tagline: 'Vice City · Est. 2026',
    size: [1080, 1080],
    panels: [],
    selected: 3, // the masthead hero
    brush: 0,
  };

  function defaultPanels() {
    const defs = panelsFor(state.layout, 100, 100);
    // Switching layouts starts each panel from the new layout's own crop: a zoom tuned for one
    // layout's panels is wrong for another's. Only the photo assignments carry over.
    const freshLayout = state.panelsLayout !== state.layout;
    state.panels = defs.map((def, i) => {
      const kept = state.panels[i];
      return {
        photo: kept ? kept.photo : state.brush,
        zoom: freshLayout || !kept ? def.zoom : kept.zoom,
        fx: def.focus[0],
        fy: def.focus[1],
        panX: freshLayout || !kept ? 0 : kept.panX,
        panY: freshLayout || !kept ? 0 : kept.panY,
      };
    });
    state.panelsLayout = state.layout;
    if (state.selected >= state.panels.length) state.selected = state.panels.length - 1;
  }

  function render() {
    fitCanvas();
    renderCover(ctx, canvas.width, canvas.height, state, state.selected);
    syncPanelControls();
  }

  function fitCanvas() {
    const stage = $('stage');
    const availW = Math.max(320, stage.clientWidth - 56);
    const availH = Math.max(320, stage.clientHeight - 56);
    const [w, h] = state.size;
    const scale = Math.min(availW / w, availH / h);
    const pw = Math.max(240, Math.round(w * scale));
    const ph = Math.max(240, Math.round(h * scale));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
  }

  // --- photos -------------------------------------------------------------------------------

  function addPhoto(img, name) {
    const photo = { id: state.nextPhotoId++, img, name };
    state.photos.push(photo);
    state.brush = state.photos.length - 1;
    if (state.panels.length === 0) defaultPanels();
    state.panels[state.selected].photo = state.brush;
    drawThumbs();
    render();
    return photo;
  }

  function loadSample(name) {
    const existing = state.photos.findIndex((p) => p.name === name);
    if (existing >= 0) {
      state.brush = existing;
      return Promise.resolve(state.photos[existing]);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(addPhoto(img, name));
      img.onerror = reject;
      img.src = `samples/${name}.jpg`;
    });
  }

  function loadFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const img = new Image();
      img.onload = () => addPhoto(img, file.name.replace(/\.[^.]+$/, ''));
      img.src = URL.createObjectURL(file);
    }
  }

  function drawThumbs() {
    const box = $('thumbs');
    box.innerHTML = '';
    state.photos.forEach((photo, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `thumb${i === state.brush ? ' active' : ''}`;
      btn.title = photo.name;
      const img = document.createElement('img');
      img.src = photo.img.src;
      img.alt = photo.name;
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        state.brush = i;
        state.panels[state.selected].photo = i;
        drawThumbs();
        render();
      });
      box.appendChild(btn);
    });
  }

  // --- panel gestures -------------------------------------------------------------------------

  function canvasPoint(evt) {
    const r = canvas.getBoundingClientRect();
    return [
      ((evt.clientX - r.left) / r.width) * canvas.width,
      ((evt.clientY - r.top) / r.height) * canvas.height,
    ];
  }

  function panelDims(i) {
    const panels = panelsFor(state.layout, canvas.width, canvas.height);
    const panel = panels[i];
    const photo = state.photos[state.panels[i].photo];
    const scale = Math.max(panel.w / photo.img.naturalWidth, panel.h / photo.img.naturalHeight) * state.panels[i].zoom;
    return { panel, dw: photo.img.naturalWidth * scale, dh: photo.img.naturalHeight * scale };
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (evt) => {
    const [x, y] = canvasPoint(evt);
    const hit = panelAt(panelsFor(state.layout, canvas.width, canvas.height), x, y);
    if (hit < 0) return;
    state.selected = hit;
    drag = { x, y };
    canvas.setPointerCapture(evt.pointerId);
    render();
  });
  canvas.addEventListener('pointermove', (evt) => {
    if (!drag) return;
    const [x, y] = canvasPoint(evt);
    const { panel, dw, dh } = panelDims(state.selected);
    const t = state.panels[state.selected];
    const overX = Math.max(1, dw - panel.w);
    const overY = Math.max(1, dh - panel.h);
    t.panX = clamp(t.panX + (x - drag.x) / overX, -0.5, 0.5);
    t.panY = clamp(t.panY + (y - drag.y) / overY, -0.5, 0.5);
    drag = { x, y };
    render();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (evt) => {
    evt.preventDefault();
    const [x, y] = canvasPoint(evt);
    const hit = panelAt(panelsFor(state.layout, canvas.width, canvas.height), x, y);
    if (hit >= 0) state.selected = hit;
    const t = state.panels[state.selected];
    t.zoom = clamp(t.zoom * (evt.deltaY < 0 ? 1.09 : 0.92), 1, 4);
    render();
  }, { passive: false });

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  // --- controls -------------------------------------------------------------------------------

  function syncPanelControls() {
    const t = state.panels[state.selected];
    if (!t) return;
    $('panel-label').textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
    $('zoom-range').value = String(t.zoom);
    $('zoom-value').textContent = `${t.zoom.toFixed(2)}×`;
  }

  function buildControls() {
    const layoutBox = $('layouts');
    for (const [name, def] of Object.entries(LAYOUTS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = def.label;
      btn.dataset.layout = name;
      btn.className = name === state.layout ? 'active' : '';
      btn.addEventListener('click', () => {
        state.layout = name;
        layoutBox.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
        defaultPanels();
        render();
      });
      layoutBox.appendChild(btn);
    }
    const gradeBox = $('grades');
    for (const [name, def] of Object.entries(GRADES)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.grade = name;
      btn.className = `grade-btn${name === state.grade ? ' active' : ''}`;
      btn.innerHTML = `<span class="swatch swatch-${name}"></span>${def.label}`;
      btn.addEventListener('click', () => {
        state.grade = name;
        gradeBox.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
        render();
      });
      gradeBox.appendChild(btn);
    }
    const exportBox = $('exports');
    for (const [w, h] of POST_SIZES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'export-btn';
      btn.textContent = `${w} × ${h}`;
      btn.addEventListener('click', () => exportPNG(w, h));
      exportBox.appendChild(btn);
    }
    $('title-input').addEventListener('input', (e) => { state.title = e.target.value; render(); });
    $('tagline-input').addEventListener('input', (e) => { state.tagline = e.target.value; render(); });
    $('zoom-range').addEventListener('input', (e) => {
      state.panels[state.selected].zoom = Number(e.target.value);
      render();
    });
    $('recenter').addEventListener('click', () => {
      const t = state.panels[state.selected];
      t.panX = 0;
      t.panY = 0;
      render();
    });
    $('fill-all').addEventListener('click', () => {
      state.panels.forEach((p) => { p.photo = state.brush; });
      render();
    });
    $('add-photo').addEventListener('click', () => $('photo-file').click());
    $('photo-file').addEventListener('change', (e) => loadFiles(e.target.files));
    $('sample-pier').addEventListener('click', () => loadSample('pier'));
    $('sample-boulevard').addEventListener('click', () => loadSample('boulevard'));
    window.addEventListener('resize', render);
    window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
    window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      document.body.classList.remove('dragging');
      loadFiles(e.dataTransfer.files);
    });
  }

  function exportPNG(w, h) {
    state.size = [w, h];
    const out = renderToCanvas(state, w, h);
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-panels-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      $('status').textContent = `Exported a ${w} × ${h} PNG.`;
      render();
    }, 'image/png');
  }

  buildControls();
  defaultPanels();

  return {
    state,
    render,
    loadSample,
    addPhoto,
    exportPNG,
    setLayout(name) {
      state.layout = name;
      document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('active', b.dataset.layout === name));
      defaultPanels();
    },
    setGrade(name) {
      state.grade = name;
      document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b.dataset.grade === name));
    },
    setWords(title, tagline) {
      if (title != null) { state.title = title; $('title-input').value = title; }
      if (tagline != null) { state.tagline = tagline; $('tagline-input').value = tagline; }
    },
    assignAll(photoIndex) {
      state.panels.forEach((p) => { p.photo = photoIndex; });
    },
  };
}
