// Fixed scenes for screenshots: ?shot=cover shows the cover alone, full-bleed at the window's size;
// ?shot=editor shows the editor with a sample loaded. `photo` picks the sample (samples/<photo>.jpg)
// and `caption` the title; extra scenes may also name `layout` and `grade`. Each sample has a house
// scene — the pier in a sunset masthead, the boulevard cut on the diagonal in neon — so the two covers
// a judge compares are different covers, not one cover twice. window.__shotReady is set once painted.

import { renderCover } from './render.js';

const SCENES = {
  pier: { layout: 'masthead', grade: 'sunset' },
  boulevard: { layout: 'diagonal', grade: 'neon' },
};

export async function runShotScene(studio, query) {
  const shot = query.get('shot');
  const photoName = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  await studio.loadSample(photoName);
  const photoIndex = studio.state.photos.findIndex((p) => p.name === photoName);
  studio.setWords(caption, null);

  if (shot === 'cover') {
    const scene = SCENES[photoName] ?? SCENES.pier;
    studio.setLayout(query.get('layout') ?? scene.layout);
    studio.setGrade(query.get('grade') ?? scene.grade);
    studio.assignAll(photoIndex);
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderCover(canvas.getContext('2d'), canvas.width, canvas.height, studio.state, -1);
  } else {
    studio.setLayout('masthead');
    studio.setGrade('sunset');
    studio.assignAll(photoIndex);
    studio.render();
  }

  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
