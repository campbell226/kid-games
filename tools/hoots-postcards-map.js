// Re-bakes the world map inside games/hoots-postcards/hoots-postcards.html.
//
// This is not a build step. The game carries the result in its WORLD
// literal and needs nothing to run; this is only for the day the map needs
// changing, say another country picked out by name for a new place.
//
// The source is Natural Earth's 1:110m countries (public domain), as
// published by world-atlas@2.0.2:
//   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
// Download that once, then:
//   node tools/hoots-postcards-map.js countries-110m.json
//
// Arcs are quantised to 0.1 degree, delta coded, and written as zigzag
// varints in a 64-letter alphabet; countries are lists of arc indices, as
// in the TopoJSON. The game's decodeWorld() reads exactly this.
const fs = require('fs');
const path = require('path');

const topo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const game = path.join(__dirname, '..', 'games', 'hoots-postcards', 'hoots-postcards.html');
const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function enc(v) {
  let z = v < 0 ? (-v * 2 - 1) : v * 2, s = '';
  while (z >= 32) { s += AL[(z & 31) | 32]; z = Math.floor(z / 32); }
  return s + AL[z];
}

const arcStr = topo.arcs.map((a) => {
  let x = 0, y = 0;
  const q = [];
  a.forEach((p) => {
    x += p[0]; y += p[1];
    const X = Math.round((x * sx + tx + 180) * 10), Y = Math.round((y * sy + ty + 90) * 10);
    const last = q[q.length - 1];
    if (!last || last[0] !== X || last[1] !== Y) { q.push([X, Y]); }
  });
  if (q.length < 2) { q.push(q[0].slice()); }
  let s = enc(q[0][0]) + enc(q[0][1]);
  for (let i = 1; i < q.length; i++) { s += enc(q[i][0] - q[i - 1][0]) + enc(q[i][1] - q[i - 1][1]); }
  return s;
}).join(',');

// The countries the game refers to by name: the places' own, plus the two
// ice sheets it paints white.
const want = {
  kenya: 'Kenya', egypt: 'Egypt', india: 'India', china: 'China', japan: 'Japan',
  australia: 'Australia', nz: 'New Zealand', antarctica: 'Antarctica', brazil: 'Brazil',
  peru: 'Peru', usa: 'United States of America', canada: 'Canada', france: 'France',
  uk: 'United Kingdom', greenland: 'Greenland'
};
const geoms = topo.objects.countries.geometries, idx = {};
const polys = geoms.map((g, i) => {
  Object.keys(want).forEach((k) => { if (g.properties.name === want[k]) { idx[k] = i; } });
  if (g.type === 'Polygon') { return [g.arcs]; }
  if (g.type === 'MultiPolygon') { return g.arcs; }
  return [];
});
Object.keys(want).forEach((k) => { if (idx[k] === undefined) { throw new Error('no country called ' + want[k]); } });

const literal = 'var WORLD = {a:"' + arcStr + '",\nc:' + JSON.stringify(polys) + ',\nn:' + JSON.stringify(idx) + '};';
const html = fs.readFileSync(game, 'utf8');
const re = /var WORLD = \{a:"[\s\S]*?\};/;
if (!re.test(html)) { throw new Error('WORLD literal not found in the game'); }
fs.writeFileSync(game, html.replace(re, () => literal));
console.log('baked', literal.length, 'bytes into', game);
