// The five cover layouts. Each returns the panels of a cover of W x H pixels: every panel is a rectangle or
// a polygon (diagonal bands), with the default crop the panel starts from — a focus point (the part of the
// photo that sits at the panel's centre, as fractions of the photo) and a zoom. Layouts also name where the
// lettering goes (titleZone), placed so the title never sits on the hero panel's subject: in the masthead it
// lives inside the detail strip, in the others behind a scrim at an edge the subject rarely fills.

function rect(x, y, w, h, focus, zoom) {
  return { x, y, w, h, poly: null, focus, zoom };
}

function band(points, focus, zoom) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {
    x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y,
    poly: points, focus, zoom,
  };
}

const BUILDERS = {
  // A strip of three detail panels over one wide hero panel — the classic game-cover masthead.
  masthead(W, H) {
    const stripH = H * 0.32;
    const third = W / 3;
    return [
      rect(0, 0, third, stripH, [0.14, 0.52], 1.55),
      rect(third, 0, third, stripH, [0.52, 0.16], 1.8),
      rect(2 * third, 0, third, stripH, [0.86, 0.45], 1.5),
      rect(0, stripH, W, H - stripH, [0.44, 0.36], 1.04),
    ];
  },
  // Three slanted bands, like a loading screen sliced on the diagonal.
  diagonal(W, H) {
    const s = (ux, uy) => [ux * W, uy * H];
    return [
      band([s(0, 0), s(1, 0), s(1, 0.3), s(0, 0.52)], [0.3, 0.1], 1.9),
      band([s(0, 0.52), s(1, 0.3), s(1, 0.62), s(0, 0.84)], [0.47, 0.315], 1.02),
      band([s(0, 0.84), s(1, 0.62), s(1, 1), s(0, 1)], [0.5, 0.86], 1.55),
    ];
  },
  // Four vertical strips, one photo seen four ways.
  strips(W, H) {
    const quarter = W / 4;
    return [
      rect(0, 0, quarter, H, [0.28, 0.34], 1.65),
      rect(quarter, 0, quarter, H, [0.44, 0.3], 1.15),
      rect(2 * quarter, 0, quarter, H, [0.58, 0.42], 1.7),
      rect(3 * quarter, 0, quarter, H, [0.66, 0.36], 1.3),
    ];
  },
  // A two-by-two grid with the title riding the top seam.
  corners(W, H) {
    const hw = W / 2, hh = H / 2;
    return [
      rect(0, 0, hw, hh, [0.4, 0.3], 1.3),
      rect(hw, 0, hw, hh, [0.6, 0.3], 1.3),
      rect(0, hh, hw, hh, [0.4, 0.62], 1.3),
      rect(hw, hh, hw, hh, [0.6, 0.62], 1.3),
    ];
  },
  // A wide centre panel flanked by two narrow ones.
  triptych(W, H) {
    const side = W * 0.27, mid = W - 2 * side;
    return [
      rect(0, 0, side, H, [0.5, 0.3], 1.55),
      rect(side, 0, mid, H, [0.45, 0.4], 1.03),
      rect(side + mid, 0, side, H, [0.5, 0.34], 1.55),
    ];
  },
};

export const LAYOUTS = {
  masthead: { label: 'Masthead', titleZone: 'strip' },
  diagonal: { label: 'Diagonal', titleZone: 'top-left' },
  strips: { label: 'Strips', titleZone: 'bottom' },
  corners: { label: 'Corners', titleZone: 'top' },
  triptych: { label: 'Triptych', titleZone: 'bottom' },
};

export function panelsFor(layout, W, H) {
  return BUILDERS[layout](W, H);
}

// Hit test for the editor: the topmost panel under a point, honouring polygon bands.
export function panelAt(panels, px, py) {
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (p.poly) {
      if (pointInPoly(px, py, p.poly)) return i;
    } else if (px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h) {
      return i;
    }
  }
  return -1;
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
