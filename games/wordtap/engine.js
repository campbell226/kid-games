// WordTap adaptive engine. Pure logic: no DOM, no storage, no speech.
// Works in the browser (as window.WordTapEngine) and under node (module.exports).
(function (root) {
  'use strict';

  // ---- every tuning number lives here ----
  var C = {
    sharedLetterWeight: 1.2, lengthDiffWeight: 0.8, levenshteinWeight: 1.5,
    rhymeWeight: 1.0, sharedOnsetWeight: 1.0,
    performanceWindow: 8,
    raiseTriggerAccuracy: 0.85, raiseTriggerRounds: 8,
    lowerTriggerAccuracy: 0.65, lowerTriggerRounds: 3,
    difficultyNudgeUp: 0.3, difficultyNudgeDown: 1.0,
    failedWordWeight: 3.0, newWordWeight: 1.5, defaultWordWeight: 1.0,
    minDifficulty: 0, maxDifficulty: 10, initialDifficulty: 3.0,
    streakCelebrationThreshold: 5,
    emptyWindowAccuracy: 0.75,
    reappearRounds: 3,
    failedLowerCount: 2,
    maxSimilarityGap: 2.0
  };

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // ---- pair similarity, 0-5 ----
  function jaccard(a, b) {
    var sa = {}, sb = {}, i, k, inter = 0, union = 0;
    for (i = 0; i < a.length; i++) { sa[a[i]] = 1; }
    for (i = 0; i < b.length; i++) { sb[b[i]] = 1; }
    for (k in sa) { union++; if (sb[k]) { inter++; } }
    for (k in sb) { if (!sa[k]) { union++; } }
    return union ? inter / union : 0;
  }

  function levenshtein(a, b) {
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) { prev[j] = j; }
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function rhymes(a, b) {
    if (a === b) { return false; }
    var n = (a.length <= 4 && b.length <= 4) ? 2 : 3;
    if (a.length < n || b.length < n) { return false; }
    return a.slice(-n) === b.slice(-n);
  }

  function sameOnset(a, b) { return a.length > 0 && b.length > 0 && a[0] === b[0]; }

  function similarity(a, b) {
    var maxLen = Math.max(a.length, b.length) || 1;
    var total = C.sharedLetterWeight + C.lengthDiffWeight + C.levenshteinWeight +
      C.rhymeWeight + C.sharedOnsetWeight;
    var sum =
      C.sharedLetterWeight * jaccard(a, b) +
      C.lengthDiffWeight * (1 / (1 + Math.abs(a.length - b.length))) +
      C.levenshteinWeight * (1 - levenshtein(a, b) / maxLen) +
      C.rhymeWeight * (rhymes(a, b) ? 1 : 0) +
      C.sharedOnsetWeight * (sameOnset(a, b) ? 1 : 0);
    return sum / total * 5;
  }

  // ---- recency-weighted accuracy: result i (1-based, oldest first) has weight i ----
  function weightedAccuracy(results) {
    if (!results.length) { return C.emptyWindowAccuracy; }
    var good = 0, all = 0, i;
    for (i = 0; i < results.length; i++) {
      all += i + 1;
      if (results[i]) { good += i + 1; }
    }
    return good / all;
  }

  // Which celebration for a correct answer. w = weighted accuracy 0-1, r = random in [0,1).
  function celebrationFor(w, r, celebrationsOn) {
    if (celebrationsOn === false) { return 'ding'; }
    var t4 = Math.max(0, w - 0.6) / 0.4 * 0.05;
    var t3 = Math.max(0, w - 0.4) / 0.6 * 0.15;
    var t2 = w * 0.45;
    if (r < t4) { return 'cheers'; }
    if (r < t4 + t3) { return 'applause'; }
    if (r < t4 + t3 + t2) { return 'horn'; }
    return 'ding';
  }

  function weightedPick(items, weights, rand) {
    var total = 0, i;
    for (i = 0; i < weights.length; i++) { total += weights[i]; }
    if (total <= 0) { return items[Math.floor(rand() * items.length)]; }
    var r = rand() * total;
    for (i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) { return items[i]; }
    }
    return items[items.length - 1];
  }

  // ---- the engine ----
  // state = { difficulty, seenWords: [..], failedWords: {word: count} }
  function Engine(words, state, rand) {
    this.words = words;
    this.rand = rand || Math.random;
    state = state || {};
    this.difficulty = typeof state.difficulty === 'number'
      ? clamp(state.difficulty, C.minDifficulty, C.maxDifficulty) : C.initialDifficulty;
    this.seen = {};
    (state.seenWords || []).forEach(function (w) { this.seen[w] = 1; }, this);
    this.failed = {};
    for (var k in (state.failedWords || {})) { this.failed[k] = state.failedWords[k]; }
    this.window = [];
    this.queue = [];          // [{word, remaining}]
    this.consecutiveAbove = 0;
    this.consecutiveBelow = 0;
    this.lastWord = null;
  }

  Engine.prototype.tier = function () {
    return Math.trunc(clamp(this.difficulty / 2, 1, 5));
  };

  Engine.prototype.accuracy = function () { return weightedAccuracy(this.window); };

  Engine.prototype.getState = function () {
    return { difficulty: this.difficulty, seenWords: Object.keys(this.seen),
      failedWords: JSON.parse(JSON.stringify(this.failed)) };
  };

  Engine.prototype.setDifficulty = function (d) {
    this.difficulty = clamp(d, C.minDifficulty, C.maxDifficulty);
  };

  function inTiers(words, tier) {
    var lo = Math.max(1, tier - 1), hi = Math.min(5, tier + 1);
    return words.filter(function (w) { return w.tier >= lo && w.tier <= hi; });
  }

  Engine.prototype.pickTarget = function () {
    var self = this, last = this.lastWord;
    var pool = inTiers(this.words, this.tier()).filter(function (w) { return w.word !== last; });
    if (!pool.length) {
      pool = this.words.filter(function (w) { return w.word !== last; });
    }
    var due = {};
    this.queue.forEach(function (q) { if (q.remaining <= 1) { due[q.word] = 1; } });
    var weights = pool.map(function (w) {
      if (due[w.word] || self.failed[w.word]) { return C.failedWordWeight; }
      if (!self.seen[w.word]) { return C.newWordWeight; }
      return C.defaultWordWeight;
    });
    var pick = weightedPick(pool, weights, this.rand);
    this.lastWord = pick.word;
    return pick;
  };

  Engine.prototype.pickDistractor = function (target) {
    var d = this.difficulty, rand = this.rand;
    var pool = inTiers(this.words, target.tier).filter(function (w) { return w.word !== target.word; });
    if (!pool.length) { pool = this.words.filter(function (w) { return w.word !== target.word; }); }
    var targetSim = d / 2, isHigh = d >= 6, isLow = d <= 3;
    var kept = [], scores = [];
    pool.forEach(function (w) {
      if (isLow && sameOnset(target.word, w.word)) { return; }
      var diff = Math.abs(similarity(target.word, w.word) - targetSim);
      if (diff > C.maxSimilarityGap) { return; }
      var score = 1 / (1 + diff);
      if (isHigh) {
        if (rhymes(target.word, w.word)) { score += 0.3; }
        if (sameOnset(target.word, w.word)) { score += 0.3; }
        if (Math.abs(target.word.length - w.word.length) <= 1) { score += 0.2; }
      }
      kept.push(w); scores.push(score);
    });
    if (!kept.length) { return pool[Math.floor(rand() * pool.length)]; }
    return weightedPick(kept, scores, rand);
  };

  Engine.prototype.nextRound = function () {
    var target = this.pickTarget();
    var distractor = this.pickDistractor(target);
    return { target: target, distractor: distractor, targetOnLeft: this.rand() < 0.5 };
  };

  // Returns { difficulty, accuracy }.
  Engine.prototype.record = function (word, correct) {
    this.window.push(!!correct);
    if (this.window.length > C.performanceWindow) { this.window.shift(); }
    this.seen[word] = 1;
    if (!correct) {
      this.failed[word] = (this.failed[word] || 0) + 1;
      this.queue.push({ word: word, remaining: C.reappearRounds });
      if (this.failed[word] > C.failedLowerCount) {
        this.difficulty = clamp(this.difficulty - C.difficultyNudgeDown, C.minDifficulty, C.maxDifficulty);
      }
    }
    var acc = weightedAccuracy(this.window);
    if (acc > C.raiseTriggerAccuracy) {
      this.consecutiveAbove++; this.consecutiveBelow = 0;
      if (this.consecutiveAbove >= C.raiseTriggerRounds) {
        this.difficulty = clamp(this.difficulty + C.difficultyNudgeUp, C.minDifficulty, C.maxDifficulty);
        this.consecutiveAbove = 0;
      }
    } else if (acc < C.lowerTriggerAccuracy) {
      this.consecutiveBelow++; this.consecutiveAbove = 0;
      if (this.consecutiveBelow >= C.lowerTriggerRounds) {
        this.difficulty = clamp(this.difficulty - C.difficultyNudgeDown, C.minDifficulty, C.maxDifficulty);
        this.consecutiveBelow = 0;
      }
    } else {
      this.consecutiveAbove = 0; this.consecutiveBelow = 0;
    }
    this.queue = this.queue
      .map(function (q) { return { word: q.word, remaining: q.remaining - 1 }; })
      .filter(function (q) { return q.remaining > 0; });
    return { difficulty: this.difficulty, accuracy: acc };
  };

  root.WordTapEngine = {
    CONSTANTS: C, Engine: Engine, similarity: similarity, levenshtein: levenshtein,
    jaccard: jaccard, rhymes: rhymes, sameOnset: sameOnset,
    weightedAccuracy: weightedAccuracy, celebrationFor: celebrationFor
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = root.WordTapEngine; }
})(typeof window !== 'undefined' ? window : this);
