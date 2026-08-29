# Kids' browser games

Browser games for my two young children — mainly for the elder, with the
younger growing into them. British English throughout. I work from a phone
or tablet as often as a laptop: keep responses short, do the work in the
file, ask with tappable options rather than prose questions where you can.

Two games exist so far, in `games/`. Each is completely self-contained —
there's no shared library, no common sound engine, nothing to import. Read
`games/animal-band/animal-band.html` before starting a new one: it's the
game that follows the rules below. `hamish-times-tables` predates them and
is deliberately exempt, so don't copy its habits or "fix" it.

## Deliverable

One self-contained HTML file per game, in its own folder (e.g.
`games/<name>/<name>.html`). Inline SVG art, no external images, no build
step, no framework unless there's a genuinely good reason for one. Portrait
and landscape both have to work.

## Design rules

- No text telling the player what to do. Meaning is carried by faces, body
  language, movement and sound. Words are for names, numbers and parent
  controls only.
- Assume the player can barely read. Numbers are fine, and maths is welcome.
- No losing, no timers, no failure states unless I ask for them. Difficulty
  comes from how much is happening at once, never from punishment.
- Big tap targets, no reflex tests, nothing that needs a steady hand.
- Characters move through the space believably — walk the gaps, turn to face
  what they're addressing, don't slide over things.
- Honour `prefers-reduced-motion`.

## Sound

Every sound effect needs a synthesised (Web Audio) fallback so a game is
never silent — that's non-negotiable. Recorded clips (children's voices,
real animal sounds) are a nice-to-have layered on top later; propose an
approach when we actually get there rather than assuming any particular
plumbing. Now that this will be a properly hosted site rather than a
sandboxed preview, plain static audio files served alongside the game are
probably simpler than anything involving a proxy — but decide that when it's
actually in front of you.

## Hosting

The goal is GitHub Pages: free, one URL, works on every device, easy to send
to family and friends, updates whenever we push. I've never used GitHub —
walk me through creating the account and the first push in plain terms, one
step at a time, when I'm ready for it.

## Working method

For anything beyond a small tweak, give me the plan first and wait — a
message is cheaper than a rebuild. Check the JavaScript parses before
calling a change done. When a file changes, say what changed and what
knock-on effects to watch for, not what the file contains.
