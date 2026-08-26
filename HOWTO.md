# How to work on Kid Games

A reminder to myself. Assumes I have forgotten everything.

| | |
|---|---|
| **Live site** | https://campbell226.github.io/kid-games/ |
| **Repo (the real project)** | https://github.com/campbell226/kid-games |
| **Copy on the laptop** | `C:\Users\campb\Projects\kid-games` |

The repo is the project. The laptop folder is a disposable working copy — it can
be deleted at any time and `git clone` brings it back whole. Never keep a copy in
Google Drive: Drive sync and git fight over the hidden `.git` folder.

**The only rule:** if it is committed and pushed, it is safe. If it is not, it
exists in one place and can be lost. `git status` says which.

---

## Editing an existing game

Pick whichever suits the device I am on.

**From a phone or tablet, nothing installed.** Open the repo and press `.`, or go
straight to:

    https://github.dev/campbell226/kid-games

That is a full editor in the browser. Edit the file, then use its Source Control
panel to commit and push. The live site updates about a minute later.

**From a computer with the clone.** Three commands, always in this order:

```bash
git pull
```

```bash
git add -A && git commit -m "what I changed"
```

```bash
git push
```

`git pull` first, every time, or a change made elsewhere will collide with this
one.

**With Claude.** Needs a checkout it can run against — either the folder on this
laptop, or Claude Code on the web pointed at the repo. Worth it for anything
beyond a tweak: ask for the plan before the code.

---

## Starting a new game

Two things to create, one to remember.

1. **The game**, self-contained, one file in its own folder:

       games/<name>/<name>.html

   Inline SVG art, no images, no build step, no framework. Everything the game
   needs is inside that one file.

2. **A tile in `index.html`**, so it can be reached from the launcher. Copy the
   existing `<a class="game">` block, point the `href` at the new file, redraw
   the little thumbnail, change the name.

3. **The thing I always forget:** the launcher tile. A game with no tile still
   works if the URL is typed directly, but nobody will ever find it.

Then commit and push as above.

---

## Seeing a game before publishing it

Just open the `.html` file in a browser — double-click it. The games are
self-contained, so they run straight off the disk with no server involved, sound
included.

The one exception: if a game is ever given real recorded audio files rather than
synthesised sound, the browser's security rules may block them when loading from
disk. Then it needs a real server, or just push it and look at it on the live
site.

---

## When something goes wrong

**`git push` is rejected.** Something changed in the repo since the last pull.
Fix:

```bash
git pull --rebase && git push
```

**The live site has not updated.** Give it two minutes. Then check the push
actually landed — the commit should be visible on the repo page. Then hard-reload
the browser; phones cache aggressively.

**The laptop folder is a mess and I want to start clean.** Everything pushed is
on GitHub, so delete the folder and clone it again:

```bash
git clone https://github.com/campbell226/kid-games.git
```

---

## The design rules

They live in `CLAUDE.md` in this repo, which is also what Claude reads
automatically. That file is the source of truth — this is only the shape of it:

- No text telling the player what to do. Faces, movement and sound carry meaning.
- No losing, no timers, no failure. Difficulty is how much is happening at once.
- Big tap targets. No reflex tests.
- Portrait and landscape both work.
- Every sound has a synthesised fallback, so a game is never silent.
- Honour `prefers-reduced-motion`.

If a rule needs changing, change it in `CLAUDE.md`, not here.
