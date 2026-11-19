// Vice Panels — a gta6-cover-art-01 entry (Node 22, standard library only). The app is this directory's app/
// folder: plain static files a desktop browser loads offline (app/index.html and its ES modules, no library and
// no network request). This program hands the entry in: it first runs a pre-flight validation of the app and the
// screenshots (authored for this entry, below), then copies app/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- Pre-flight validation ------------------------------------------------------------------------------
// The gate refuses entries whose files break its caps, and a broken app only fails later, in the finalist
// review, so this entry checks itself first: every file the app needs at run time must be present, and every
// screenshot must be a whole JPEG or PNG inside the gate's size and dimension limits. Any failure exits
// non-zero with the reason named, before a single byte is copied to /output.

const REQUIRED_APP_FILES = [
  'index.html',
  'style.css',
  'src/main.js',
  'src/grade.js',
  'src/layouts.js',
  'src/lettering.js',
  'src/render.js',
  'src/editor.js',
  'src/shots.js',
  'samples/pier.jpg',
  'samples/boulevard.jpg',
];

const SCREENSHOT_MAX_BYTES = 262144; // 256 KiB, the gate's per-screenshot cap
const SCREENSHOT_LONG_SIDE_MAX = 1280;
const SCREENSHOT_SHORT_SIDE_MIN = 480;

function preflightFail(reason: string): never {
  console.error(`preflight: ${reason}`);
  process.exit(1);
}

// The pixel dimensions of a JPEG or PNG buffer, read from its own headers; null when the bytes are neither.
function imageSize(bytes: Buffer): { width: number; height: number; kind: string } | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), kind: 'PNG' };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5), kind: 'JPEG' };
      }
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  return null;
}

function runPreflight(): void {
  for (const rel of REQUIRED_APP_FILES) {
    if (!existsSync(join(here, 'app', rel))) preflightFail(`app/${rel} is missing`);
  }
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) preflightFail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    preflightFail(`screenshots/ holds ${shots.length} images; the gate takes 3 or 4`);
  }
  for (const name of shots) {
    const file = join(shotsDir, name);
    const { size } = statSync(file);
    if (size > SCREENSHOT_MAX_BYTES) {
      preflightFail(`screenshots/${name} is ${size} bytes, over the ${SCREENSHOT_MAX_BYTES}-byte cap`);
    }
    const info = imageSize(readFileSync(file));
    if (!info) preflightFail(`screenshots/${name} is not a whole JPEG or PNG`);
    const longSide = Math.max(info.width, info.height);
    const shortSide = Math.min(info.width, info.height);
    if (longSide > SCREENSHOT_LONG_SIDE_MAX || shortSide < SCREENSHOT_SHORT_SIDE_MIN) {
      preflightFail(
        `screenshots/${name} is ${info.width}x${info.height}; long side must be <= ${SCREENSHOT_LONG_SIDE_MAX} and short side >= ${SCREENSHOT_SHORT_SIDE_MIN}`,
      );
    }
  }
}

runPreflight();

// --- Hand-in --------------------------------------------------------------------------------------------

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
