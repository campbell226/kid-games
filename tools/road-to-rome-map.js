// Bakes the land outline for Juno's Road to Rome's map.
//
// Not a build step: the game carries the result as its LAND literal and
// needs nothing to run. This is only for the day the map needs changing.
//
// The source is the world map already baked into Hoot's Postcards (Natural
// Earth 1:110m countries, public domain, via world-atlas@2.0.2). It takes
// every country near the road from Eboracum to Rome, keeps the rings that
// fall in the frame, projects them (longitude squeezed by cos 47 degrees,
// so Britain and Italy keep their shapes) and writes one SVG path in
// tenths of a degree, with no borders: the countries are only land.
//
//   node tools/road-to-rome-map.js
//
// prints the literal to paste over the game's `var LAND = ...` line.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'games', 'hoots-postcards', 'hoots-postcards.html'), 'utf8');
const m = src.match(/var WORLD = (\{[\s\S]*?\});/);
let WORLD;
eval('WORLD = ' + m[1]);

const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const AI = {};
for (let i = 0; i < 64; i++) { AI[AL[i]] = i; }
const ARCS = WORLD.a.split(',').map((s) => {
  const vals = [];
  let v = 0, mul = 1;
  for (const ch of s) {
    const c = AI[ch];
    v += (c & 31) * mul;
    if (c & 32) { mul *= 32; } else { vals.push(v % 2 ? -(v + 1) / 2 : v / 2); v = 0; mul = 1; }
  }
  let x = vals[0], y = vals[1];
  const pts = [[x / 10 - 180, y / 10 - 90]];
  for (let j = 2; j < vals.length; j += 2) { x += vals[j]; y += vals[j + 1]; pts.push([x / 10 - 180, y / 10 - 90]); }
  return pts;
});
function ring(idx) {
  const out = [];
  idx.forEach((i) => {
    const a = i < 0 ? ARCS[~i].slice().reverse() : ARCS[i];
    for (let k = out.length ? 1 : 0; k < a.length; k++) { out.push(a[k]); }
  });
  return out;
}

// the frame, in degrees
const LON0 = -12, LON1 = 24, LAT0 = 35, LAT1 = 61, K = Math.cos(47 * Math.PI / 180);
let d = '';
WORLD.c.forEach((polys) => {
  polys.forEach((poly) => {
    poly.forEach((r) => {
      const pts = ring(r);
      let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
      pts.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      if (x1 < LON0 || x0 > LON1 || y1 < LAT0 || y0 > LAT1 || x1 - x0 > 60) { return; }
      let last = '';
      const seg = [];
      pts.forEach((p) => {
        const X = Math.round((p[0] - LON0) * K * 10), Y = Math.round((LAT1 - p[1]) * 10);
        const s = X + ' ' + Y;
        if (s !== last) { seg.push(s); last = s; }
      });
      if (seg.length > 2) { d += 'M' + seg.join('L') + 'Z'; }
    });
  });
});
console.log('var LAND = { k: ' + K.toFixed(4) + ', lon0: ' + LON0 + ', lat1: ' + LAT1 + ', d: \'' + d + '\' };');
