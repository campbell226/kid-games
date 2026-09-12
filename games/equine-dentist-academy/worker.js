// The Academy's records office.
//
// This is not part of the game. It runs on Cloudflare, keeps one record
// per rider in KV, and holds the Director's password. Paste it into the
// Cloudflare dashboard editor; there is nothing to build and nothing to
// install, and it can be edited from a tablet.
//
// Why a server at all, when every other game here saves nothing: a rider
// who only exists on one tablet is a rider her brother can reach. Her
// casebook, her rank and the settings the Director chose for her follow
// her name, not the glass she happens to be holding.
//
// The same reasoning as the dictionary worker applies to what this is
// worth stealing, and the answer is again nothing. There is no key here
// and no money behind it. What an intruder can do is write horse-quiz
// scores for a family of four, and only in a shape this file allows: the
// names are matched against a pattern, the roll is capped at MAX_RIDERS,
// every field is rebuilt here rather than trusted, and a record that
// will not fit in MAX_RECORD bytes is refused. A day's writes are capped
// too, so the worst case is that the Academy stops taking new marks
// until tomorrow - which the game already knows how to survive, because
// it keeps its own copy on the tablet regardless.
//
// A save MERGES. Solved and seen cases are sets that only ever grow,
// best and rounds take the higher number, awards keep the earlier date.
// Two tablets playing the same rider at once therefore cannot rub each
// other out, and a tablet that was offline for a week pushes its week up
// intact whenever it next gets through. Wiping is a separate op on
// purpose, so that a merge can never do it by accident.
//
// Settings are not writable by a save. Only the Director's op touches
// them, and that op wants the password every time - so a tablet cannot
// quietly hand itself more lifelines by editing what it sends.
//
// ---------------------------------------------------------------------
// Setting it up, once, at dash.cloudflare.com:
//
//   1. Workers & Pages -> Create -> Worker. Name it `academy`.
//      Deploy the placeholder, then Edit code and paste this file in.
//   2. Storage & Databases -> KV -> Create a namespace called `academy`.
//   3. Back in the worker: Settings -> Bindings -> add a KV Namespace
//      binding named exactly `ACADEMY`, pointed at that namespace.
//   4. Settings -> Variables and Secrets -> add a Secret named exactly
//      `DIRECTOR_PASSWORD`, with whatever word you want to use. Secret,
//      not Variable: a Variable is readable afterwards, and readable is
//      what the old password in the game file was.
//   5. Deploy, then open the worker's URL in a browser. It should answer
//      with post_only and both bindings true.
//
// To change the password: edit the secret here. Nothing in the game
// changes and no tablet needs telling.
//
// To take a rider off the roll: the Director's own area in the game does
// it, and leaves a headstone so a tablet that still has her cached
// cannot push her back. Deleting `rider:<name>` in the KV dashboard by
// hand skips that headstone, and she will return the next time anybody
// taps her name.
// ---------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://campbell226.github.io';

// A family, with room for cousins. The cap is what stops a stranger
// filling the picker with a thousand names for a child to scroll past.
const MAX_RIDERS = 12;

// A full casebook with every award is about 1.5 KB. This is generous
// enough never to bite in play and small enough that the namespace
// cannot be used as free storage.
const MAX_RECORD = 4096;

// Two children finishing a ten-case exam write perhaps twenty times a
// day between them. This is a ceiling on abuse, not a budget.
const DAILY_WRITES = 2000;

// Wrong passwords per day, across everybody. Fifty is far more than a
// parent who has forgotten it will need and far fewer than a guesser.
const DAILY_GUESSES = 50;

const NAME = /^[A-Za-z][A-Za-z' -]{0,15}$/;
const CASE_ID = /^[a-z0-9-]{1,32}$/;
const AWARD_ID = /^[a-z0-9-]{1,24}$/;
const MAX_CASES = 200;
const MAX_AWARDS = 20;

// Exactly what the Director's panel offers, and nothing else. Anything
// not on this list falls back to the default rather than being refused,
// so an older tablet sending an older shape still saves.
const SETTINGS = {
  examLength: { values: [5, 10, 15], fallback: 10 },
  vet: { values: [0, 1, 2, 3], fallback: 1 },
  hint: { values: [0, 1, 2, 3], fallback: 1 },
  halve: { values: [true, false], fallback: true },
  second: { values: [true, false], fallback: false },
  gentle: { values: [true, false], fallback: true }
};
const NUMERIC = ['examLength', 'vet', 'hint'];
const MAX_NOTE = 140;

// How long a deleted rider stays deleted.
//
// Deleting the record is not enough on its own. Every tablet keeps its
// own copy, and a save merges - so the next time anybody tapped her name
// on a tablet that had not heard, she would be pushed back whole and the
// Director's decision would quietly undo itself. A headstone is left
// behind instead, and a save that would recreate her is refused until it
// expires. Seven days is longer than a tablet goes unopened here.
//
// Typing the name in again is how she comes back, and that carries
// `fresh`, which lifts the headstone. Tapping a remembered name does
// not, which is the whole distinction: one is somebody deciding, the
// other is a stale cache.
const GONE_DAYS = 7;

// The logbook.
//
// Entries are written here rather than sent here. Nothing in the game can
// add a line: the lines are a side effect of the things the log is about -
// an exam that finished, settings the Director changed, a rider removed.
// So there is no write endpoint to find, and no entry can exist without
// the thing it records having actually happened. The wording is composed
// here too, so a tablet cannot choose what the log says about it.
//
// Reading it wants the Director's password, the same one that opens the
// area the link lives in. There is deliberately no second password: one
// more secret to set, remember and rotate, guarding the same cupboard
// from the same person, is a lock on the inside of an unlocked door.
const LOG_DAYS = 180;
const LOG_MAX = 200;

const LABELS = {
  examLength: 'Patients per exam',
  vet: 'Ask the vet',
  hint: "Nutmeg's hint",
  halve: 'Lifelines cost half',
  second: 'Second chance',
  gentle: 'Easier cases only'
};

function shownAs(v) {
  return v === true ? 'on' : (v === false ? 'off' : String(v));
}

function describeSettings(before, after) {
  const bits = [];
  for (const k of Object.keys(SETTINGS)) {
    if (before[k] !== after[k]) {
      bits.push(LABELS[k] + ' ' + shownAs(before[k]) + ' → ' + shownAs(after[k]));
    }
  }
  if ((before.note || '') !== (after.note || '')) {
    bits.push(after.note ? 'message set to "' + after.note + '"' : 'message cleared');
  }
  return bits;
}

// Newest first, by inverting the clock into the key: KV lists keys in
// order, and the alternative is reading the whole log to sort it.
async function logLine(env, kind, rider, text) {
  const now = Date.now();
  const key = 'log:' + String(9999999999999 - now).padStart(13, '0') +
    '-' + Math.random().toString(36).slice(2, 8);
  const entry = {
    t: new Date(now).toISOString(),
    kind: kind,
    rider: rider || '',
    text: String(text).slice(0, 300)
  };
  try {
    await env.ACADEMY.put(key, JSON.stringify(entry), {
      metadata: entry,
      expirationTtl: LOG_DAYS * 86400
    });
  } catch (e) {
    // A log that cannot be written is not a reason to fail the exam it
    // was recording. The child's casebook matters more than the note.
  }
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ 'content-type': 'application/json' }, cors(origin))
  });
}

function day(prefix) {
  return prefix + '-' + new Date().toISOString().slice(0, 10);
}

// One space between words, so "  Bramble " and "Bramble" are the same
// rider rather than two entries a child cannot tell apart.
function cleanName(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  return NAME.test(name) ? name : null;
}

function slugOf(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanIds(raw, pattern) {
  if (!Array.isArray(raw)) { return []; }
  const out = [];
  for (const item of raw) {
    const id = String(item);
    if (pattern.test(id) && out.indexOf(id) < 0) { out.push(id); }
    if (out.length >= MAX_CASES) { break; }
  }
  return out;
}

function cleanDate(raw) {
  const t = Date.parse(raw);
  return isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

function cleanAwards(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') { return out; }
  let n = 0;
  for (const id of Object.keys(raw)) {
    if (!AWARD_ID.test(id) || n >= MAX_AWARDS) { continue; }
    out[id] = cleanDate(raw[id]);
    n++;
  }
  return out;
}

function cleanCount(raw, cap) {
  const n = Math.floor(Number(raw));
  return isFinite(n) && n > 0 ? Math.min(n, cap) : 0;
}

function cleanSettings(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const out = {};
  for (const key of Object.keys(SETTINGS)) {
    const spec = SETTINGS[key];
    // Absent is not the same as false. Coercing a missing key with !!
    // lands on false, which is a value the booleans accept - so a new
    // rider was quietly being handed free lifelines and the whole bank
    // of cases, rather than the gentler defaults the game intends.
    if (src[key] === undefined || src[key] === null) { out[key] = spec.fallback; continue; }
    const given = NUMERIC.indexOf(key) >= 0 ? Math.floor(Number(src[key])) : !!src[key];
    out[key] = spec.values.indexOf(given) >= 0 ? given : spec.fallback;
  }
  // The note is shown to a child at the end of every exam, so it is
  // stripped to plain text here rather than trusted to be escaped later.
  out.note = String(src.note == null ? '' : src.note)
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOTE);
  return out;
}

function blank(name) {
  return {
    name: name,
    solved: [],
    seen: [],
    best: 0,
    rounds: 0,
    muted: false,
    awards: { 'stable-hand': new Date().toISOString() },
    settings: cleanSettings(null),
    updated: new Date().toISOString()
  };
}

// The whole of what a tablet is allowed to change about itself. Note
// what is missing: settings, which only the Director writes.
function merge(current, incoming, name) {
  const out = current ? JSON.parse(JSON.stringify(current)) : blank(name);
  // The name on the record is the one she enrolled under. Names are
  // matched by slug, so a tablet sending "bramble" finds Bramble - and
  // must not be able to rename her in everyone's picker by doing so.
  out.name = (current && current.name) || name;
  out.muted = !!incoming.muted;

  const solved = cleanIds(incoming.solved, CASE_ID);
  const seen = cleanIds(incoming.seen, CASE_ID);
  out.solved = cleanIds((out.solved || []).concat(solved), CASE_ID);
  out.seen = cleanIds((out.seen || []).concat(seen, out.solved), CASE_ID);
  out.best = Math.max(out.best || 0, cleanCount(incoming.best, 1e7));
  out.rounds = Math.max(out.rounds || 0, cleanCount(incoming.rounds, 1e5));

  const awards = cleanAwards(incoming.awards);
  out.awards = cleanAwards(out.awards);
  for (const id of Object.keys(awards)) {
    // The earlier of the two dates: a certificate says when it was
    // earned, and it was earned the first time, not the last.
    if (!out.awards[id] || awards[id] < out.awards[id]) { out.awards[id] = awards[id]; }
  }
  out.settings = cleanSettings(out.settings);
  out.updated = new Date().toISOString();
  return out;
}

// A byte at a time rather than ===, so the time this takes says nothing
// about how much of the password was right.
function same(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length) { return false; }
  let diff = 0;
  for (let i = 0; i < x.length; i++) { diff |= x.charCodeAt(i) ^ y.charCodeAt(i); }
  return diff === 0;
}

// Counters fail closed: if KV will not answer, nothing is written.
async function spend(env, prefix, cap) {
  const key = day(prefix);
  let used;
  try {
    used = parseInt(await env.ACADEMY.get(key), 10) || 0;
  } catch (e) {
    return { ok: false, error: 'store_unavailable', status: 503 };
  }
  if (used >= cap) {
    return { ok: false, error: 'daily_cap', status: 429 };
  }
  try {
    // Two days, so a counter never outlives the day it counts.
    await env.ACADEMY.put(key, String(used + 1), { expirationTtl: 172800 });
  } catch (e) {
    return { ok: false, error: 'store_unavailable', status: 503 };
  }
  return { ok: true };
}

async function readRider(env, key) {
  const raw = await env.ACADEMY.get(key);
  if (!raw) { return null; }
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// The roll comes out of the keys themselves, with the summary carried as
// KV metadata written in the same breath as the record. There is no
// separate roster key to drift out of step with what is actually stored.
async function writeRider(env, key, record) {
  const body = JSON.stringify(record);
  if (body.length > MAX_RECORD) { return { ok: false, error: 'too_big', status: 413 }; }
  await env.ACADEMY.put(key, body, {
    metadata: { name: record.name, solved: record.solved.length, updated: record.updated }
  });
  return { ok: true };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') {
      // Opening the URL in a browser is the proof-of-life check. Both
      // answers are booleans on purpose: whether a secret exists gives
      // nothing away, and it separates "misnamed or undeployed" from
      // "wrong value", which look identical from the outside.
      return json({
        error: 'post_only',
        store: !!env.ACADEMY,
        password: !!env.DIRECTOR_PASSWORD
      }, 405, origin);
    }
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: 'origin' }, 403, origin);
    }
    if (!env.ACADEMY) {
      return json({ error: 'store_unbound' }, 503, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'bad_json' }, 400, origin);
    }
    const op = String(body && body.op || '');

    // ---- the roll, for the picker on the title screen ----
    if (op === 'list') {
      let listed;
      try {
        listed = await env.ACADEMY.list({ prefix: 'rider:', limit: MAX_RIDERS });
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      const riders = listed.keys.map(k => ({
        name: (k.metadata && k.metadata.name) || k.name.slice(6),
        solved: (k.metadata && k.metadata.solved) || 0,
        updated: (k.metadata && k.metadata.updated) || null
      }));
      riders.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
      return json({ riders: riders }, 200, origin);
    }

    // ---- the logbook ----
    if (op === 'log') {
      if (!env.DIRECTOR_PASSWORD) { return json({ error: 'no_password_set' }, 503, origin); }
      if (!same(body && body.password, env.DIRECTOR_PASSWORD)) {
        const spent = await spend(env, 'guesses', DAILY_GUESSES);
        if (!spent.ok) { return json({ error: 'locked_out' }, 429, origin); }
        return json({ ok: false }, 403, origin);
      }
      let listed;
      try {
        listed = await env.ACADEMY.list({ prefix: 'log:', limit: LOG_MAX });
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      return json({ entries: listed.keys.map(k => k.metadata).filter(Boolean) }, 200, origin);
    }

    const name = cleanName(body && body.name);
    if (op === 'load' || op === 'save' || op === 'clear' || op === 'settings' || op === 'delete') {
      if (!name) { return json({ error: 'bad_name' }, 400, origin); }
    }
    const slug = name ? slugOf(name) : null;
    const key = slug ? 'rider:' + slug : null;
    const tomb = slug ? 'gone:' + slug : null;

    // ---- one rider's record ----
    if (op === 'load') {
      let record;
      try {
        record = await readRider(env, key);
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      return json({ record: record }, 200, origin);
    }

    if (op === 'save' || op === 'clear') {
      let current;
      try {
        current = await readRider(env, key);
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      if (!current) {
        // Only worth asking when there is no record: a rider who exists
        // cannot also be buried, so the common save costs no extra read.
        let buried;
        try {
          buried = await env.ACADEMY.get(tomb);
        } catch (e) {
          return json({ error: 'store_unavailable' }, 503, origin);
        }
        if (buried && !(body && body.fresh)) {
          return json({ error: 'gone' }, 410, origin);
        }
        if (buried) {
          try { await env.ACADEMY.delete(tomb); } catch (e) { /* it will expire anyway */ }
        }

        let listed;
        try {
          listed = await env.ACADEMY.list({ prefix: 'rider:', limit: MAX_RIDERS + 1 });
        } catch (e) {
          return json({ error: 'store_unavailable' }, 503, origin);
        }
        if (listed.keys.length >= MAX_RIDERS) {
          return json({ error: 'roll_full', cap: MAX_RIDERS }, 409, origin);
        }
      }

      const spent = await spend(env, 'writes', DAILY_WRITES);
      if (!spent.ok) { return json({ error: spent.error }, spent.status, origin); }

      let record;
      if (op === 'clear') {
        // Everything the Academy taught her, forgotten on purpose. The
        // settings survive: the Director chose those, not the rider, and
        // clearing a casebook is not a reason to hand back the lifelines.
        record = blank(name);
        record.settings = cleanSettings(current && current.settings);
        record.muted = !!(current && current.muted);
      } else {
        record = merge(current, (body && body.record) || {}, name);
      }

      let written;
      try {
        written = await writeRider(env, key, record);
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      if (!written.ok) { return json({ error: written.error }, written.status, origin); }

      if (op === 'clear') {
        await logLine(env, 'cleared', record.name, record.name + ' cleared her casebook');
      } else {
        // A finished round, if one is being reported. The numbers are
        // rebuilt here like everything else, and the sentence is written
        // here rather than sent, so a tablet cannot narrate itself.
        const round = (body && body.round) || null;
        const total = round ? cleanCount(round.total, 500) : 0;
        if (total > 0) {
          const right = Math.min(cleanCount(round.right, 500), total);
          const score = cleanCount(round.score, 1e7);
          const newly = cleanCount(round.newly, 500);
          const exam = round.mode !== 'practice';
          let line = record.name + (exam ? ' finished an exam: ' : ' practised: ') +
            right + ' of ' + total + ' right';
          if (exam) { line += ', ' + score + ' points'; }
          if (newly) { line += ', ' + newly + ' new case' + (newly === 1 ? '' : 's'); }
          await logLine(env, exam ? 'exam' : 'practice', record.name, line);
        }
      }
      return json({ record: record }, 200, origin);
    }

    // ---- the Director ----
    if (op === 'unlock' || op === 'settings' || op === 'delete') {
      if (!env.DIRECTOR_PASSWORD) {
        return json({ error: 'no_password_set' }, 503, origin);
      }
      if (!same(body && body.password, env.DIRECTOR_PASSWORD)) {
        // Spend a guess only when the guess was wrong, so a Director
        // who knows the password can open the panel all day.
        const spent = await spend(env, 'guesses', DAILY_GUESSES);
        if (!spent.ok) { return json({ error: 'locked_out' }, 429, origin); }
        return json({ ok: false }, 403, origin);
      }
      if (op === 'unlock') { return json({ ok: true }, 200, origin); }

      // Taking a rider off the roll. Her casebook, her rank and her
      // certificates go with her, and none of it can be got back - which
      // is why the game asks twice and says her name while it does.
      if (op === 'delete') {
        const spent = await spend(env, 'writes', DAILY_WRITES);
        if (!spent.ok) { return json({ error: spent.error }, spent.status, origin); }
        try {
          await env.ACADEMY.delete(key);
          await env.ACADEMY.put(tomb, new Date().toISOString(), { expirationTtl: GONE_DAYS * 86400 });
        } catch (e) {
          return json({ error: 'store_unavailable' }, 503, origin);
        }
        await logLine(env, 'removed', name, 'Director removed ' + name + ' from the roll');
        return json({ ok: true, name: name }, 200, origin);
      }

      let current;
      try {
        current = await readRider(env, key);
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      if (!current) { return json({ error: 'no_such_rider' }, 404, origin); }

      const spent = await spend(env, 'writes', DAILY_WRITES);
      if (!spent.ok) { return json({ error: spent.error }, spent.status, origin); }

      const wasSettings = cleanSettings(current.settings);
      current.settings = cleanSettings(body && body.settings);
      current.updated = new Date().toISOString();
      let written;
      try {
        written = await writeRider(env, key, current);
      } catch (e) {
        return json({ error: 'store_unavailable' }, 503, origin);
      }
      if (!written.ok) { return json({ error: written.error }, written.status, origin); }

      const changes = describeSettings(wasSettings, current.settings);
      await logLine(env, 'settings', name, changes.length
        ? 'Director changed ' + name + ' — ' + changes.join('; ')
        : 'Director saved ' + name + ' with nothing changed');
      return json({ ok: true, record: current }, 200, origin);
    }

    return json({ error: 'bad_op' }, 400, origin);
  }
};
