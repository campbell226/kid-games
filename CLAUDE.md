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
step, no framework unless there's a genuinely good reason for one. Sound
is the one exception — see below. Portrait
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
never silent — that's non-negotiable, and it stays true even once there
are recordings.

That question is settled now. Post a Letter keeps 26 recorded letter sounds
in `games/post-a-letter/sounds/`, played through plain `<audio>`
elements as ordinary static files. Copy that rather than inventing
something else, including the two things holding it up: every clip is
started and stopped once, muted, on the first touch, because a phone
won't play a sound no finger asked for and the game has to speak on its
own between rounds; and any clip that won't load or play falls through
to the synthesised chime.

The mp3s are the only copies kept. Tidying the raw recordings — trim,
mono, loudness-match — was a one-off ffmpeg pass, not a build step, and
there is still nothing to run to open a game. If a clip ever needs
redoing, the original recordings are recoverable from the repo's history
(commit e57d1f1).

Stargazing's 72 lines of Dad's voice, in `games/stargazing/sounds/`,
work the same way. They were cut from eight long recordings, which are
in commit 6f2b3ce.

Inside Me's 270 part names, in `games/inside-me/sounds/`, are Dad's voice
too, cut from one recording (commit 173fac6, `Take A.m4a`; the script he
read from is in 331e12f). The low-cut at 130 Hz matters: the room had a
rumble below 200 Hz. Cuts start 0.2 s before the sound, because a tight
cut turned "ten" into "en". Unlike the others it has no synthesised
fallback and no text-to-speech: a name with no clip, a fact, or a clip
that won't play is simply shown as text. Names map to files by `slug()`.

Hoot's Postcards' hellos, in `games/hoots-postcards/sounds/`, are the
one set that isn't ours: real speakers from Wikimedia Commons, mostly
Lingua Libre, under CC0, CC BY or CC BY-SA. `sounds/CREDITS.md` names
each speaker and licence, and has to stay with the clips: attribution
is the condition of using them. The originals are on Commons, linked
from there. The phone's own text-to-speech was tried for these and
dropped: the hellos it read were more annoying than useful.

Chess Quest's "Classic" pieces are Cburnett's set from Wikimedia Commons
(CC BY-SA 3.0), embedded in the page; its `CREDITS.md` has to stay beside
it. The other three piece styles (Friends, Blocks, Shadows) are drawn in
the page. It speaks piece names with the device's speech synthesis only,
no recordings, and falls back to each piece's synthesised tune.

Juno's Road to Rome (which replaced Roman Numeral Workshop; the old
address redirects) reads its story aloud with the device's speech, en-GB,
switchable in the parent panel. The words are always on screen too, typed
out with a blip voice where there is no speech. The puzzles themselves
have no words. Every sound effect is synthesised.

## Maps

Hoot's Postcards carries its own world: Natural Earth's 1:110m countries
(public domain), from `world-atlas@2.0.2` on jsdelivr, quantised to 0.1°
and baked into the page as its `WORLD` literal, about 25 KB. Nothing is
fetched when it runs, so it works offline in the app. If a place ever
needs another country picked out by name, `tools/hoots-postcards-map.js`
re-bakes it from that file. Like the ffmpeg pass, it is a one-off, not a
build step.

Juno's Road to Rome's little real map (the inset on its road map) is the
coast of the same data, from Eboracum to Rome, baked into its `LAND`
literal (about 11 KB, no borders) by `tools/road-to-rome-map.js`, which
reads Hoot's `WORLD`. Same rule: a one-off, nothing to run.

## Adult mode

A game that needs parent controls (skipping levels, settings, resetting
progress) reaches them the same way everywhere. Copy the `AdultGate` block
from `games/post-a-letter/post-a-letter.html` (it sits just before
`<div id="parent"`) and call `AdultGate.attach(openParent)`.

- A gear in the top-right corner flashes three times at launch, then is
  invisible. With reduced motion it shows steadily for about 3 seconds, then
  fades.
- Holding it for 1.5 s asks one random question (2 to the power 3, the first
  digit of pi, and so on) answered on a number pad. Right opens the controls;
  wrong closes quietly. It is a speed bump for a child button-bashing, not
  security. Add questions to the `QS` list in each copy.
- Where a game has levels, the panel's first section is "open every
  level" and "start again" (the second needs a confirming tap). Game-specific
  settings go below it. Words are fine in the panel.
- Don't draw a visible cog or corner dot of your own.

Players: games that keep one child's progress apart from another's (Chess
Quest, Recorder Garden 1 and 2, Hoot's Postcards, Juno's Road to Rome) have
named players. A child
may add themselves from the picker (the + tile) without the gate; rename,
delete, "open everything" and "start again" are parent-only, per player, in
the panel's Players section. The picker shows only with two or more players
and the adult gear stays visible on it. The newer games embed the
`Players` block that sits just before their main script (Chess Quest has an
older hand-built version): each player owns the game's whole save, the old
single save migrates in as Player 1, and changing player reloads the page so
no scene has to be rebuilt. Copy that block, not Chess Quest's, into any
game that gains saved levels. Equine Dentist Academy is deliberately left
alone; every other game is meant for a single sitting.

Applied so far to Chess Quest, Dictionary, Numberbots, Post a Letter,
Post a Number, Recorder Garden 1 and 2, Hoot's Postcards and Juno's Road to
Rome. The others have no parent controls yet; add the gate when one
needs them.

## Hosting

Live on GitHub Pages from `campbell226/kid-games`, served straight off
`main`, so a push is a release, under the custom domain in `CNAME`. Each
game sits at `https://kidgames.jamesinthe.uk/games/<name>/<name>.html`;
the old `campbell226.github.io/kid-games/` address redirects there.

The two workers (Dictionary, Equine Dentist Academy) refuse any page whose
origin is not on their `ALLOWED_ORIGINS` list. If the domain ever changes
again, both lists change with it and both workers are redeployed, or
those games quietly stop answering — which is what the move to the custom
domain did on 11 October 2026. The Android app's `Site.HOST` changes too,
and the app is reinstalled.

That URL is not a convenience. A browser refuses the microphone and camera
to any page that is not on https, so a game with ears does nothing at all
opened off the disk — Recorder Garden is the first of those. Anything built
on a permission like that needs a fallback that still works without it.

## Android app

`android/` is a thin wrapper for the kids to use on a phone: one
full-screen web view, no address bar, links out blocked, and screen pinning
offered at launch. `android/README.md` explains it, and
`android/install.ps1` builds it and installs it over wireless debugging.

It answers requests for the real domain itself, from a copy of `index.html`
and `games/` bundled at build time, and when it opens it fetches from GitHub
whatever main has changed since. So:

- A push to a game reaches the app on its own. Only a change under
  `android/` needs a rebuild and reinstall.
- A game works offline in the app only if everything it needs is under
  `games/`. Anything fetched from elsewhere works online only.
- The app grants the microphone and nothing else. A game that needs the
  camera or any other permission needs a change to `MainActivity` too.
- The app supplies speech synthesis, speech recognition and the screen wake
  lock itself, under the standard browser names, because the web view has
  none that work. A game uses them exactly as it would in Chrome, and still
  needs its fallback for a browser that lacks them.
- A white screen that never clears (the "whiteout") is the web view losing
  its GPU, usually just as the app comes back to the front. It is not the
  game's doing and a game can neither see it nor fix it: the app restarts
  itself when it happens (`GpuWatch.kt`). Traced on 30 October 2026, after
  the game had been blamed twice.

## Secrets

Never put a credential in a game file. Not in plain text, not encoded, not
obfuscated, not split into pieces. These files are served on a public URL,
so every one of their bytes is handed to every visitor; the page has to be
able to read a key to use it, therefore so can anyone who opens the
developer console. Obfuscation only defeats pattern scanners, and pattern
scanners were never the threat.

This is not a hypothetical. Dictionary shipped a scrambled API key on
6 September 2026 and the balance was spent by a stranger overnight. What
limited the damage was money, not code: a prepaid balance with auto-reload
off. See HOWTO.md for the whole account of it.

Dictionary now asks a Cloudflare worker (`games/dictionary/worker.js`) that
holds the key. Copy that shape if another game ever needs one, and copy the
reason with it: the worker is safe not because it hides a key but because
the endpoint is not worth stealing. The model and the prompt live on the
worker, so the page cannot ask for anything except one word explained at one
reading age, and a counter stops the day after a thousand of those. Never
let a page send its own prompt to a proxy — that turns it straight back
into a free general-purpose model for whoever finds the URL.

## Working method

For anything beyond a small tweak, give me the plan first and wait — a
message is cheaper than a rebuild. When a file changes, say what changed and
what knock-on effects to watch for, not what the file contains.

Write game files with the Write and Edit tools, never by piping content
through a shell command. The shell truncates a command at about 8 KB and then
reports a syntax error naming whatever quote fell either side of the cut —
usually an innocent apostrophe hundreds of lines away — so the error tells you
nothing about the real problem. A quoted heredoc does not save you; the
content was never at fault. The shell is for running things: git, node, wc.

## Before calling a change done

- The JavaScript parses. Pull the `<script>` blocks out of the game and run
  `node --check` over them.
- If a tile was added or edited, `index.html` still holds unique SVG ids and
  every `url(#…)` resolves. Every tile lives in one document and shares one id
  namespace, so a clash is silent — Picture Pop spent weeks drawing its sky
  with Post a Letter's gradient because both had defined `p-sky`.
- To actually look at a tile, write a throwaway page holding the SVGs at about
  640px wide and put it **inside this folder** — the browser pane will not
  screenshot a file outside the project. Delete it before committing.
- A new tile carries `data-added` (the date its folder first appeared in
  git, `git log --diff-filter=A --format=%as -- games/<name>`),
  `data-age` (a range like `4-7`) and `data-tags` (extra words for the
  search box). Without them it still shows but sorts to the end. "Last
  updated" sorting needs nothing; it asks GitHub.
- Nothing to do for the "last updated" footer. It asks GitHub which commit
  last touched `games/` and takes the game's name from the tile's own link,
  so adding a tile is the whole of the work. It was a hand-kept list of
  timestamps for about an hour, which was long enough for one of them to be
  typed rather than looked up and to announce a change three hours into the
  future. Do not reintroduce that list.
