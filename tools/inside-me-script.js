// One-off: reads every name and fact Inside Me speaks and writes a numbered
// recording script to games/inside-me/RECORDING-SCRIPT.md. Not a build step.
//   node tools/inside-me-script.js
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/../games/inside-me/inside-me.html', 'utf8');
var Q = "'((?:[^'\\\\]|\\\\.)*)'";
var re = new RegExp("\\bn: " + Q + "(?:, alt: " + Q + ")?(?:, f: " + Q + ")?", 'g');
var m, names = [], facts = [], seenN = {}, seenF = {};
function clean(t) { return t.replace(/\\'/g, "'").replace(/\\\\/g, '\\'); }
while ((m = re.exec(src))) {
  var n = clean(m[1]);
  if (!seenN[n]) { seenN[n] = 1; names.push(n); }
  if (m[3]) { var f = clean(m[3]); if (!seenF[f]) { seenF[f] = 1; facts.push(f); } }
}
var out = [];
out.push('# Inside Me: recording script\n');
out.push('Read each numbered line aloud, in order, **without saying the number**.');
out.push('Leave a clear pause (about 2 seconds of quiet) after every line. That gap is how the');
out.push('recording gets cut up, so a stumble is fine: pause, then read the line again');
out.push('and put "REDO" in your upload note, or just say it twice in a row.\n');
out.push('Do it in as many takes as you like. Suggested: one take of names, then facts in chunks of about 40.\n');
out.push('## Take A: names (' + names.length + ' lines, short)\n');
names.forEach(function (t, i) { out.push((i + 1) + '. ' + t); });
var chunk = 40, take = 0;
for (var i = 0; i < facts.length; i += chunk) {
  take++;
  out.push('\n## Take ' + String.fromCharCode(65 + take) + ': facts ' + (i + 1) + ' to ' + Math.min(i + chunk, facts.length) + '\n');
  facts.slice(i, i + chunk).forEach(function (t, j) { out.push((i + j + 1) + '. ' + t); });
}
out.push('\nPlus one more, on its own: "Yum"');
fs.writeFileSync(__dirname + '/../games/inside-me/RECORDING-SCRIPT.md', out.join('\n') + '\n');
console.log(names.length + ' names, ' + facts.length + ' facts');
