# How to work on Kid Games

All work happens through Claude Code. I never run git myself — Claude commits
and pushes, and the live site follows about a minute later.

| | |
|---|---|
| **Live site** | https://campbell226.github.io/kid-games/ |
| **Repo (the real project)** | https://github.com/campbell226/kid-games |
| **Copy on the laptop** | `C:\Users\campb\Projects\kid-games` |

The repo is the project. Any local folder is a disposable working copy. Never
keep one in Google Drive — Drive sync and git fight over the hidden `.git`
folder.

---

## Starting a session

**On this laptop.** Open Claude Code in `C:\Users\campb\Projects\kid-games`.
Everything is already set up: the GitHub sign-in is saved, so pushes just work.

**Anywhere else** — a different computer, or Claude Code on the web. Say:

> Clone kid-games from GitHub and work there.

That is the whole setup. Nothing to install, nothing to configure, and the new
machine is immediately equal to this one.

---

## Asking for a new game

Say what the play actually is — what the child does and what happens back. Claude
will reply with a plan and then wait. That pause is deliberate and worth using: a
message is far cheaper than a rebuilt game.

Questions it will need answered, so worth having a view on:

- **Which child is it mainly for**, and what maths they can handle. These are far
  apart — the elder reads very little but is comfortable with times tables.
- **Is there a maths hook**, or is it a pure toy with no goal?
- **How many characters or pieces?** Difficulty in these games comes from how
  much is happening at once, never from punishment, so this is the main dial.

Claude then writes one self-contained HTML file in `games/<name>/`, adds a tile
to the launcher so the game can actually be found, and pushes.

---

## Asking for a change

Describe what I *saw*, not what to change in the code. "The frog's walk is too
slow", "six at once is a mess", "the cow is unrecognisable" are all more useful
than a guess at which line is wrong.

Small tweaks get made directly. Anything larger gets a plan first, same as a new
game.

---

## Claude cannot see the games

This matters more than it sounds. Claude can verify that the code runs, that
tap targets are big enough and do not overlap, that nothing falls off the screen
in either orientation — but it cannot look at the result. This environment gives
it no pixels.

**So I am the eyes.** Anything about how it *looks* or *feels* — whether an
animal reads as that animal, whether a movement is charming or creepy, whether
the whole thing is fun — only reaches Claude if I say it. Nothing else will
catch it.

---

## Before finishing a session

Two questions, in order:

> Is everything committed and pushed?

Then open the live URL on the phone and reload hard. Phones cache aggressively,
so if it looks unchanged, that is the first suspect, not the code.

If it is pushed, it is safe, and any local folder can be deleted without a
second thought.

---

## The design rules

They live in `CLAUDE.md` in this repo, which is what Claude reads automatically
at the start of every session. That file is the source of truth — this is only
its shape:

- No text telling the player what to do. Faces, movement and sound carry meaning.
- No losing, no timers, no failure states.
- Big tap targets. No reflex tests.
- Portrait and landscape both work.
- Every sound has a synthesised fallback, so a game is never silent.
- Honour `prefers-reduced-motion`.

To change how the games are made, change `CLAUDE.md`, not this file. Claude obeys
that one automatically; it only reads this one if asked.

---

## If Claude is ever unavailable

The one fallback worth knowing: open the repo on github.com and press `.`, which
gives a full editor in the browser with no install, on any device.

    https://github.dev/campbell226/kid-games

Edit the file, then commit and push from its Source Control panel.
