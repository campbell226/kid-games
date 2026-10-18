// Vibe With Me's clock.
//
// This is not part of the game. It runs on Cloudflare and does one thing:
// says what time it is, to the millisecond. Every device playing asks it,
// so every device has the same answer, and the game's beat is worked out
// from that answer - which is what puts two rooms on the same beat of the
// same loop without anyone pressing anything together.
//
// It used to be each device's own clock, and two of those can disagree by
// a second, which at ninety is a beat and a half. There was a whole screen
// for making up the difference by hand, and getting it right was more
// than a child could be asked to do. Once this had proved itself, that
// screen went.
//
// Worth stealing: nothing. There is no key, no storage and no money
// behind it, and the answer is the time, which anybody can already have.
// Somebody hammering it can at worst use up the day's free requests, and
// then each device plays on its own, by its own clock, until the
// allowance comes back - and the badge in the game's corner says so.
//
// The request is a plain GET with no headers of its own, so a browser
// sends it straight off without asking first, and the round trip it is
// timing is one trip rather than two.
//
// Deployed with `npx wrangler deploy` from this folder; see wrangler.jsonc.
// To check it is alive, open its URL: it answers with a long number.

export default {
  fetch() {
    // Read before anything else is done. In a worker the clock stands
    // still between pieces of I/O, so this is the moment the request
    // arrived, which is the moment the device's round trip is centred on.
    const now = Date.now();
    return new Response(String(now), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // A cached time is a wrong time.
        'cache-control': 'no-store',
        // Open to any page, including one opened off the disk, whose
        // origin is "null". The time is not a secret.
        'access-control-allow-origin': '*'
      }
    });
  }
};
