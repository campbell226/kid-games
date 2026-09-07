// Dictionary's back door.
//
// This is not part of the game. It runs on Cloudflare, holds the API key,
// and is the only thing in the system that ever sees it. Paste it into the
// Cloudflare dashboard editor; there is nothing to build and nothing to
// install, and it can be edited from a tablet.
//
// The point of it is not that it hides a key. It is that there is nothing
// here worth stealing. The only thing this endpoint can be made to do is
// explain one word to a child at a given reading age: the model is fixed,
// the prompt is fixed and lives here rather than in the page, and the
// request body is two fields that are checked before anything is spent.
// Whoever finds the URL gets children's definitions of words, which is
// not a thing anybody resells.
//
// The ceiling is the second half. A counter in KV stops the day at
// DAILY_WORDS, so the worst case if this is found and hammered is that
// Hoot goes to sleep until tomorrow, which the game already knows how to
// do. It is a bounded, boring failure rather than an empty balance.
//
// ---------------------------------------------------------------------
// Setting it up, once, at dash.cloudflare.com:
//
//   1. Workers & Pages -> Create -> Worker. Name it `dictionary`.
//      Deploy the placeholder, then Edit code and paste this file in.
//   2. Storage & Databases -> KV -> Create a namespace called `dictionary`.
//   3. Back in the worker: Settings -> Bindings -> add a KV Namespace
//      binding named exactly `COUNTER`, pointed at that namespace.
//   4. Settings -> Variables and Secrets -> add a Secret named exactly
//      `ANTHROPIC_API_KEY`, with a fresh key from console.anthropic.com.
//      Secret, not Variable: a Variable is readable afterwards.
//   5. Deploy. Send the worker's URL to Claude to put in the game.
//
// To rotate: make a new key in the Console, revoke the old one, edit the
// secret here. The game never changes and no device needs re-keying.
//
// To change how Hoot talks: edit systemPrompt below and redeploy. The
// prompt lives here on purpose - if the page could send its own prompt,
// this endpoint would be a free general-purpose model again, which is
// precisely what went wrong last time.
// ---------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://campbell226.github.io';

const MODEL = 'claude-haiku-4-5';

// About 0.03p a word, so a thousand words is roughly 30p a day. Two
// children will not get near it; it is a ceiling on abuse, not a budget.
const DAILY_WORDS = 1000;

// A word, not a sentence: letters, and the punctuation that turns up
// inside real words. Anything else is somebody probing.
const WORD = /^[a-z][a-z' -]{0,27}$/;

function systemPrompt(age) {
  const cap = age <= 4 ? 22 : (age <= 6 ? 30 : (age <= 8 ? 40 : 55));
  return 'You are a kind, twinkly owl called Hoot who explains words to a British child ' +
    'of about ' + age + ' years old.\n' +
    'Reply with one or two very short sentences and nothing else: first what the word means, ' +
    'then an everyday example that starts with "Like when".\n' +
    'Use only words a ' + age + '-year-old already knows. Never use the word itself, or any ' +
    'form of it, inside the explanation.\n' +
    'British English. No markdown, no quotation marks, no lists, no greeting, no sign-off.\n' +
    'Stay under ' + cap + ' words.\n' +
    'If it is not a real word, say gently that you have not heard that one, in the same voice.\n' +
    'Everything you say is read aloud to a small child, so keep it warm and never frightening.';
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

function today() {
  return 'words-' + new Date().toISOString().slice(0, 10);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') {
      // Opening the URL in a browser is the proof-of-life check, so it
      // may as well say whether the two bindings actually resolved. Both
      // are booleans on purpose: whether a secret exists gives nothing
      // away, and it separates "misnamed or undeployed" from "wrong
      // value", which are the two ways this fails and look identical
      // from the outside.
      return json({
        error: 'post_only',
        key: !!env.ANTHROPIC_API_KEY,
        counter: !!env.COUNTER
      }, 405, origin);
    }
    // A browser on another site is stopped by CORS anyway; this stops the
    // page being embedded somewhere else and quietly spending the day.
    // It does nothing against a script setting its own headers, which is
    // what the counter below is for.
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: 'origin' }, 403, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'bad_json' }, 400, origin);
    }

    const word = String(body && body.word || '').toLowerCase().trim();
    const age = Math.round(Number(body && body.age));

    if (!WORD.test(word)) { return json({ error: 'bad_word' }, 400, origin); }
    if (!(age >= 3 && age <= 11)) { return json({ error: 'bad_age' }, 400, origin); }

    // The ceiling. Read, refuse, or spend and count.
    //
    // KV is eventually consistent and its free tier allows a thousand
    // writes a day, which is the same order as the cap - so under a real
    // hammering the writes start failing at roughly the moment the cap
    // would have bitten anyway. Either way this refuses rather than
    // spends: it fails closed, which is the only sensible direction for
    // something whose failure mode costs money.
    const key = today();
    let used = 0;
    try {
      used = parseInt(await env.COUNTER.get(key), 10) || 0;
    } catch (e) {
      return json({ error: 'counter_unavailable' }, 503, origin);
    }
    if (used >= DAILY_WORDS) {
      return json({ error: 'daily_cap', used: used, cap: DAILY_WORDS }, 429, origin);
    }
    try {
      // Two days, so a counter never outlives the day it counts.
      await env.COUNTER.put(key, String(used + 1), { expirationTtl: 172800 });
    } catch (e) {
      return json({ error: 'counter_unavailable' }, 503, origin);
    }

    let upstream;
    try {
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 200,
          system: systemPrompt(age),
          messages: [{ role: 'user', content: word }]
        })
      });
    } catch (e) {
      return json({ error: 'upstream_unreachable' }, 502, origin);
    }

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 200);
      return json({ error: 'upstream_' + upstream.status, detail: detail }, 502, origin);
    }

    const data = await upstream.json();
    let text = '';
    for (const block of (data.content || [])) {
      if (block.type === 'text') { text += block.text; }
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) { return json({ error: 'empty' }, 502, origin); }

    return json({ text: text, used: used + 1, cap: DAILY_WORDS }, 200, origin);
  }
};
