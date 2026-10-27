// Bakes Libre Caslon Text into Prisoner's Dilemma, so the game needs no
// network for its typeface.
//
// A one-off, like the map in hoots-postcards-map.js: there is nothing to
// run to open the game. Run this only to change the fonts.
//
//   node tools/prisoners-dilemma-font.js regular.woff2 italic.woff2 bold.woff2
//
// The three files are Google Fonts' Latin subsets of Libre Caslon Text
// (SIL Open Font License 1.1), as linked from
// https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400
// with a current Chrome user agent, which is what makes it hand out woff2.
// Each lands in the @font-face whose src starts with the matching marker,
// /*font:regular*/, /*font:italic*/ or /*font:bold*/, replacing whatever
// was baked there before. The marker sits outside url(), because CSS
// doesn't see comments inside one.

'use strict';

var fs = require('fs');
var path = require('path');

var page = path.join(__dirname, '..', 'games', 'prisoners-dilemma', 'prisoners-dilemma.html');
var names = ['regular', 'italic', 'bold'];
var files = process.argv.slice(2);
if (files.length !== names.length) {
  console.error('usage: node tools/prisoners-dilemma-font.js regular.woff2 italic.woff2 bold.woff2');
  process.exit(1);
}

var html = fs.readFileSync(page, 'utf8');
names.forEach(function (name, i) {
  var b64 = fs.readFileSync(files[i]).toString('base64');
  var re = new RegExp('/\\*font:' + name + '\\*/url\\(data:font/woff2;base64,[A-Za-z0-9+/=]*\\)');
  if (!re.test(html)) {
    console.error('no marker for ' + name);
    process.exit(1);
  }
  html = html.replace(re, function () { return '/*font:' + name + '*/url(data:font/woff2;base64,' + b64 + ')'; });
  console.log(name + ': ' + b64.length + ' characters');
});
fs.writeFileSync(page, html);
