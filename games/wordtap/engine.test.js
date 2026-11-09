// Run: node games/wordtap/engine.test.js
const assert = require('assert');
const E = require('./engine.js');
const words = require('./words.json');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
const near = (a, b) => Math.abs(a - b) < 1e-9;

t('levenshtein', () => {
  assert.strictEqual(E.levenshtein('cat', 'cat'), 0);
  assert.strictEqual(E.levenshtein('cat', 'bat'), 1);
  assert.strictEqual(E.levenshtein('kitten', 'sitting'), 3);
});

t('rhyme: suffix 2 for short words, 3 otherwise; identical never rhymes', () => {
  assert.ok(E.rhymes('cat', 'hat'));
  assert.ok(!E.rhymes('cat', 'cat'));
  assert.ok(!E.rhymes('cat', 'dog'));
  assert.ok(E.rhymes('light', 'night'));
  assert.ok(!E.rhymes('light', 'sit'));
});

t('similarity is 0-5 and ordered sensibly', () => {
  const same = E.similarity('cat', 'cat');
  assert.ok(near(same, 5 * (1.2 + 0.8 + 1.5 + 0 + 1.0) / 5.5));
  assert.ok(E.similarity('cat', 'hat') > E.similarity('cat', 'elephant'));
  const lo = E.similarity('a', 'zzzzzzzz');
  assert.ok(lo >= 0 && same <= 5);
});

t('weighted accuracy', () => {
  assert.strictEqual(E.weightedAccuracy([]), 0.75);
  assert.ok(near(E.weightedAccuracy([true, true, true]), 1));
  assert.ok(near(E.weightedAccuracy([false, false, false]), 0));
  // weights 1,2,3 : correct = 1 + 3 = 4 of 6
  assert.ok(near(E.weightedAccuracy([true, false, true]), 4 / 6));
});

t('celebration thresholds', () => {
  assert.strictEqual(E.celebrationFor(1, 0.049, true), 'cheers');
  assert.strictEqual(E.celebrationFor(1, 0.1, true), 'applause');
  assert.strictEqual(E.celebrationFor(1, 0.3, true), 'horn');
  assert.strictEqual(E.celebrationFor(1, 0.9, true), 'ding');
  assert.strictEqual(E.celebrationFor(0, 0.0, true), 'ding');
  assert.strictEqual(E.celebrationFor(1, 0.0, false), 'ding');
});

t('raise: 8 rounds above 85% lifts difficulty by 0.3', () => {
  const e = new E.Engine(words, { difficulty: 4 });
  for (let i = 0; i < 7; i++) { e.record('w' + i, true); }
  assert.strictEqual(e.difficulty, 4);
  e.record('w8', true);
  assert.ok(near(e.difficulty, 4.3));
});

t('lower: 3 rounds below 65% drops difficulty by 1', () => {
  const e = new E.Engine(words, { difficulty: 4 });
  e.record('a', false); e.record('b', false);
  assert.strictEqual(e.difficulty, 4);
  e.record('c', false);
  assert.strictEqual(e.difficulty, 3);
});

t('difficulty is clamped to 0-10', () => {
  const e = new E.Engine(words, { difficulty: 0.5 });
  for (let i = 0; i < 6; i++) { e.record('x' + i, false); }
  assert.strictEqual(e.difficulty, 0);
  const f = new E.Engine(words, { difficulty: 9.9 });
  for (let i = 0; i < 40; i++) { f.record('y', true); }
  assert.ok(f.difficulty <= 10);
});

t('a word failed more than twice drops difficulty at once', () => {
  const e = new E.Engine(words, { difficulty: 6, failedWords: { cat: 2 } });
  e.record('cat', false);
  assert.ok(e.difficulty <= 5);
});

t('re-appearance queue ticks down and expires', () => {
  const e = new E.Engine(words, { difficulty: 4 });
  e.record('cat', false);
  assert.strictEqual(e.queue[0].remaining, 2);
  e.record('dog', true); e.record('sun', true);
  assert.strictEqual(e.queue.length, 0);
});

t('tier from difficulty', () => {
  assert.strictEqual(new E.Engine(words, { difficulty: 3 }).tier(), 1);
  assert.strictEqual(new E.Engine(words, { difficulty: 5 }).tier(), 2);
  assert.strictEqual(new E.Engine(words, { difficulty: 10 }).tier(), 5);
  assert.strictEqual(new E.Engine(words, { difficulty: 0 }).tier(), 1);
});

t('rounds: never repeat last word, distractor differs, low difficulty avoids same onset', () => {
  const e = new E.Engine(words, { difficulty: 2 });
  let last = null;
  for (let i = 0; i < 300; i++) {
    const r = e.nextRound();
    assert.notStrictEqual(r.target.word, last);
    assert.notStrictEqual(r.target.word, r.distractor.word);
    assert.notStrictEqual(r.target.word[0], r.distractor.word[0]);
    last = r.target.word;
  }
});

t('state round-trips and persists difficulty', () => {
  const e = new E.Engine(words, { difficulty: 6.5, seenWords: ['cat'], failedWords: { dog: 2 } });
  const s = e.getState();
  assert.strictEqual(s.difficulty, 6.5);
  assert.deepStrictEqual(s.seenWords, ['cat']);
  assert.deepStrictEqual(s.failedWords, { dog: 2 });
});

console.log('\n' + n + ' tests passed');
