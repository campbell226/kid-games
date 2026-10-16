// Fills in what Android's web view leaves out of a browser - speaking,
// listening and keeping the screen awake - with the phone's own, under the
// standard names, so a game written for a browser needs nothing special to
// run in the app. The app runs this before each page's own scripts, on the
// games' own address only, and it fills a gap only where there is one.
(function () {
  'use strict';
  var port = window.KidGamesBridge;
  if (!port) { return; }

  var wantTalk = !window.speechSynthesis;
  var wantWake = !(navigator.wakeLock && navigator.wakeLock.request);
  // Listening is always the app's. The web view does have a recogniser of
  // its own, but it never asks for the microphone and always uses Google's
  // online one, where the app's tries the phone's own first.
  var wantEar = true;

  // Every request carries an id the app answers with. The page part keeps an
  // answer meant for the page before from landing on this one.
  var page = Math.random().toString(36).slice(2, 10);
  var count = 0;
  var live = {};
  function newId() { count += 1; return page + ':' + count; }

  function send(msg) {
    try { port.postMessage(JSON.stringify(msg)); } catch (e) { /* the app has gone */ }
  }

  // The onfoo properties, called the way a browser calls them: as one more
  // listener for that event.
  function withHandlers(target, types) {
    types.forEach(function (type) {
      target['on' + type] = null;
      target.addEventListener(type, function (ev) {
        var h = target['on' + type];
        if (typeof h === 'function') { h.call(target, ev); }
      });
    });
  }

  function fire(target, type, props) {
    var ev = new Event(type);
    if (props) { Object.keys(props).forEach(function (k) { ev[k] = props[k]; }); }
    target.dispatchEvent(ev);
  }

  var answers = {};
  port.onmessage = function (e) {
    var m;
    try { m = JSON.parse(e.data); } catch (err) { return; }
    var answer = answers[m.t];
    if (answer) { answer(m); }
  };

  // ---------------------------------------------------------------- speaking
  if (wantTalk) {
    var voices = [], askedVoices = false, queue = [], started = {};
    // A page asking for more than this at once is a finger on a button.
    var MOST_QUEUED = 30;

    var askVoices = function () {
      if (!askedVoices) { askedVoices = true; send({ t: 'voices' }); }
    };

    class SpeechSynthesisUtterance extends EventTarget {
      constructor(text) {
        super();
        this.text = text === undefined ? '' : String(text);
        this.lang = '';
        this.voice = null;
        this.volume = 1;
        this.rate = 1;
        this.pitch = 1;
        withHandlers(this, ['start', 'end', 'error', 'boundary', 'pause', 'resume', 'mark']);
      }
    }

    class SpeechSynthesis extends EventTarget {
      constructor() {
        super();
        withHandlers(this, ['voiceschanged']);
      }
      get speaking() { return queue.length > 0 && !!started[queue[0]]; }
      get pending() { return queue.length > (this.speaking ? 1 : 0); }
      get paused() { return false; }
      getVoices() { askVoices(); return voices.slice(); }
      speak(u) {
        if (!(u instanceof SpeechSynthesisUtterance)) {
          throw new TypeError('speak() needs a SpeechSynthesisUtterance');
        }
        askVoices();
        if (queue.length >= MOST_QUEUED) {
          setTimeout(function () { fire(u, 'error', { error: 'audio-busy', utterance: u, charIndex: 0 }); }, 0);
          return;
        }
        var id = newId();
        live[id] = u;
        queue.push(id);
        send({
          t: 'speak', id: id, text: u.text,
          lang: u.lang || (u.voice && u.voice.lang) || document.documentElement.lang || '',
          voice: u.voice ? u.voice.voiceURI : '',
          rate: Number(u.rate) || 1, pitch: Number(u.pitch) || 1,
          volume: isFinite(u.volume) ? Number(u.volume) : 1
        });
      }
      // The app answers each utterance it drops with an "interrupted" or
      // "canceled" error, as a browser does.
      cancel() { if (queue.length) { send({ t: 'hush' }); } }
      pause() {}
      resume() {}
    }

    var synth = new SpeechSynthesis();
    window.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });

    var finished = function (id) {
      delete live[id];
      delete started[id];
      var at = queue.indexOf(id);
      if (at >= 0) { queue.splice(at, 1); }
    };

    answers.voices = function (m) {
      voices = (m.list || []).map(function (v) {
        return Object.freeze({ voiceURI: v.id, name: v.name, lang: v.lang, localService: !!v.local, 'default': !!v.isDefault });
      });
      fire(synth, 'voiceschanged');
    };
    answers.start = function (m) {
      var u = live[m.id];
      if (!u) { return; }
      started[m.id] = true;
      fire(u, 'start', { utterance: u, charIndex: 0, elapsedTime: 0, name: '' });
    };
    answers.boundary = function (m) {
      var u = live[m.id];
      if (u) { fire(u, 'boundary', { utterance: u, charIndex: m.at, charLength: m.len, name: 'word' }); }
    };
    answers.end = function (m) {
      var u = live[m.id];
      if (!u) { return; }
      finished(m.id);
      fire(u, 'end', { utterance: u, charIndex: u.text.length, elapsedTime: 0, name: '' });
    };
    answers.error = function (m) {
      var u = live[m.id];
      if (!u) { return; }
      finished(m.id);
      fire(u, 'error', { utterance: u, error: m.error, charIndex: 0, elapsedTime: 0 });
    };
  }

  // --------------------------------------------------------------- listening
  if (wantEar) {
    class SpeechRecognition extends EventTarget {
      constructor() {
        super();
        this.lang = '';
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.grammars = null;
        withHandlers(this, ['start', 'end', 'result', 'error', 'nomatch', 'audiostart', 'audioend',
          'soundstart', 'soundend', 'speechstart', 'speechend']);
        Object.defineProperty(this, '_id', { value: '', writable: true });
        Object.defineProperty(this, '_began', { value: false, writable: true });
      }
      start() {
        if (this._id) { throw new DOMException('Recognition has already started.', 'InvalidStateError'); }
        this._id = newId();
        this._began = false;
        live[this._id] = this;
        send({
          t: 'listen', id: this._id,
          lang: this.lang || document.documentElement.lang || '',
          alts: Math.max(1, Math.min(10, this.maxAlternatives | 0)),
          interim: !!this.interimResults
        });
      }
      stop() { if (this._id) { send({ t: 'stop', id: this._id }); } }
      abort() { if (this._id) { send({ t: 'abort', id: this._id }); } }
    }
    window.SpeechRecognition = SpeechRecognition;
    window.webkitSpeechRecognition = SpeechRecognition;

    var results = function (m) {
      var alts = (m.alts || []).map(function (a) {
        return Object.freeze({ transcript: a.text, confidence: a.confidence });
      });
      alts.isFinal = !!m.final;
      alts.item = function (i) { return alts[i] || null; };
      var list = [alts];
      list.item = function (i) { return list[i] || null; };
      return list;
    };

    answers.hearing = function (m) {
      var r = live[m.id];
      if (!r || r._began) { return; }
      r._began = true;
      fire(r, 'start');
      fire(r, 'audiostart');
    };
    answers.speech = function (m) {
      var r = live[m.id];
      if (r) { fire(r, 'soundstart'); fire(r, 'speechstart'); }
    };
    answers.quiet = function (m) {
      var r = live[m.id];
      if (r) { fire(r, 'speechend'); fire(r, 'soundend'); }
    };
    answers.heard = function (m) {
      var r = live[m.id];
      if (r) { fire(r, 'result', { results: results(m), resultIndex: 0 }); }
    };
    answers.deaf = function (m) {
      var r = live[m.id];
      if (r) { fire(r, 'error', { error: m.error, message: '' }); }
    };
    answers.done = function (m) {
      var r = live[m.id];
      if (!r) { return; }
      delete live[m.id];
      r._id = '';
      if (r._began) { fire(r, 'audioend'); }
      fire(r, 'end');
    };
  }

  // ------------------------------------------------------------ staying awake
  if (wantWake) {
    class WakeLockSentinel extends EventTarget {
      constructor(id) {
        super();
        Object.defineProperty(this, '_id', { value: id });
        this.type = 'screen';
        this.released = false;
        withHandlers(this, ['release']);
      }
      release() {
        if (!this.released) {
          send({ t: 'wake', id: this._id, on: false });
          dropWake(this);
        }
        return Promise.resolve();
      }
    }

    var dropWake = function (s) {
      s.released = true;
      delete live[s._id];
      fire(s, 'release');
    };

    var wakeLock = {
      request: function (type) {
        if (type !== undefined && type !== 'screen') {
          return Promise.reject(new TypeError('Only a screen wake lock is offered.'));
        }
        if (document.visibilityState !== 'visible') {
          return Promise.reject(new DOMException('The page is not visible.', 'NotAllowedError'));
        }
        var id = newId();
        var s = new WakeLockSentinel(id);
        live[id] = s;
        send({ t: 'wake', id: id, on: true });
        return Promise.resolve(s);
      }
    };
    Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true });

    // As in a browser, a page that is out of sight loses its wake locks.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { return; }
      Object.keys(live).forEach(function (id) {
        if (live[id] instanceof WakeLockSentinel) {
          send({ t: 'wake', id: id, on: false });
          dropWake(live[id]);
        }
      });
    });
  }
})();
