// Vice Panels entry point: build the studio and load a sample photo so the first paint is already a
// finished cover; when the URL names a screenshot scene (?shot=...), stage that scene instead.

import { createStudio } from './editor.js';
import { runShotScene } from './shots.js';

const studio = createStudio();
const query = new URLSearchParams(location.search);

if (query.has('shot')) {
  await runShotScene(studio, query);
} else {
  await studio.loadSample('pier');
  studio.render();
}
