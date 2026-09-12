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

**Hamish's Times Tables is deliberately exempt.** It was written before these
rules and breaks three of them — Google Fonts, written instructions, and a
streak that resets on a wrong answer. That is a settled decision, not an
oversight, and it is not to be "fixed". The rules govern new games.

---

## Dictionary, and the one game that costs money

Dictionary is the only game that talks to anything outside itself. She says a
word, Hoot explains it at whatever reading age the slider is set to. The
explanation comes from Anthropic's API, which is billed per word.

### How it works now

No device holds a key and neither does the game file. Dictionary sends two
fields — the word, and the reading age — to a small Cloudflare worker of ours.
The worker holds the key, builds the prompt, calls Haiku and sends back one
sentence.

The point is not that the worker hides the key better. It is that **the
endpoint is not worth stealing**. All it can be made to do is explain one word
to a child; the model and the prompt live on the worker, not in the page, so
nobody who finds the URL gets a general-purpose model. And it counts: after a
thousand words in a day it refuses, and Hoot goes to sleep until tomorrow.
Worst case is a bounded, boring failure instead of an empty balance.

There are two ceilings, deliberately. Each device stops itself at 200 words a
day; the worker stops the whole household at 1,000, which is about 30p and
cannot be wished away by clearing a browser.

### Setting up the worker, once

Cloudflare renames things in its dashboard from time to time, so if a menu is
not where this says, search for the word in bold — the concepts do not move,
only the labels.

**Before Cloudflare — get the Anthropic side ready.** At
<https://console.anthropic.com>:

1. **Billing.** The balance is negative after September, so add credit. $5 is
   the minimum. Leave **auto-reload off**.
2. **API keys → Create Key.** Check the workspace field says `kid-games` and
   not `Default` — that field defaults, and getting it wrong is the likeliest
   reason the $3 limit did nothing last time.
3. Copy the key. It is shown once. Keep it in the clipboard or a password
   manager for the next few minutes; it is going straight into Cloudflare and
   nowhere else.

**Step 1 — an account.** Sign up at <https://dash.cloudflare.com>. Workers has
a free tier that covers this many times over and **does not ask for a card**.
If it offers to add a domain, skip it; none is needed.

**Step 2 — create the worker.** In the left sidebar, **Workers & Pages**
(newer dashboards call this **Compute**) → **Create** → **Create Worker**.

- Name it `dictionary`. The name becomes part of the URL, so it matters.
- The first worker you ever make asks you to pick a **workers.dev subdomain**.
  Choose something and remember it — it is permanent and it is the middle part
  of every worker URL you will ever have.
- Deploy the Hello World placeholder it offers. It is about to be replaced.

**Step 3 — paste the code.** On the worker's page, **Edit code** (or the `</>`
icon). Select everything in the editor, delete it, and paste the whole of
`games/dictionary/worker.js` from this repo. Then **Deploy**, top right.

The editor works on an iPad but select-all and paste in it are fiddly. If a
laptop is to hand, this is the one step worth doing there.

**Step 4 — the counter's storage.** The worker keeps its daily tally in KV, so
that has to exist before it can be bound.

- Sidebar → **Storage & Databases** → **KV** → **Create a namespace**.
- Call it `dictionary`. That name is for you; the binding name in the next
  step is the one the code actually uses.

**Step 5 — bind it.** Back on the worker → **Settings** → **Bindings** →
**Add** → **KV namespace**.

- **Variable name:** `COUNTER` — exactly that, capitals and all. The code
  looks for `env.COUNTER` and will fail with `counter_unavailable` if it is
  spelled anything else.
- **KV namespace:** the `dictionary` one from step 4.

**Step 6 — the key.** Worker → **Settings** → **Variables and Secrets** →
**Add**.

- Type: **Secret**, not Variable. A Variable can be read back out of the
  dashboard afterwards; a Secret cannot.
- **Name:** `ANTHROPIC_API_KEY` — exactly that.
- **Value:** the key from before Cloudflare.

**Step 7 — deploy and check.** If a **Deploy** button has appeared after those
settings changes, press it; bindings and secrets only reach the running worker
on a deploy.

The worker's URL is on its overview page and looks like
`https://dictionary.your-subdomain.workers.dev`.

**Open that URL in a browser.** It should show, in plain text:

    {"error":"post_only"}

That is the correct answer and it means the worker is alive — the game sends
POST requests, and a browser address bar sends GET. Anything else means
something is wrong:

| What you see | What it means |
|---|---|
| `{"error":"post_only"}` | Working. Go to step 8. |
| A Cloudflare error page | The worker did not deploy. Re-check step 3. |
| `{"error":"counter_unavailable"}` | The KV binding is missing or misnamed. Step 5. |
| Nothing / cannot connect | Wrong URL, or the deploy has not finished. Wait a minute. |

**Step 8 — send the URL to Claude**, who puts it in the game and pushes. Then
open Dictionary and type a word. If it comes back, it is done. If it does not,
long-press the top-right corner: the parent panel prints the exact error the
worker gave, and `upstream_401` there means the secret in step 6 is wrong.

**To rotate the key,** make a new one in the Anthropic console, revoke the old
one, and edit the secret in Cloudflare. The game does not change and no device
needs touching. **To change how Hoot talks,** edit `systemPrompt` in the worker
and redeploy — that is the cost of keeping the prompt out of the page, and it
is the trade that makes the endpoint safe.

### Why it is built this way

**6 September 2026.** A key was scrambled into `dictionary.html` and pushed.
By the following morning a stranger had spent the whole $5 balance on Fable
5.1 and the account stood at −$0.33. The key was revoked on 7 September.

The reasoning that put it there was that scrambling would break the `sk-ant-`
pattern the scanners and bots match on, and that those were the real threat.
They were not. **The game is served on a public URL**, so the key was not
sitting in a repository somebody had to find — it was handed to every visitor
who opened the developer console. No amount of scrambling changes that,
because the page has to unscramble it to use it.

Two things held, and both were money rather than code:

- The balance was **prepaid with auto-reload off**, so the loss stopped at $5.
- An API key can only **spend**. It carries no access to the Console, to
  billing details, to the card, or to anything on claude.ai — not the account,
  not conversations, not memory. Nothing personal was exposed.

One thing did not hold: a **$3 monthly workspace limit was exceeded**, and why
is unresolved. The likeliest explanation is that the key was created in the
*Default* workspace rather than in `kid-games` — that field defaults, and it is
easy to miss.

**Still keep the balance prepaid with auto-reload off.** The worker's counter
is the everyday ceiling; the balance is the one that does not depend on any
code of ours being correct.

**Running costs.** Measured, not guessed: a 165-token prompt and a 30-to-70
token answer on Haiku 4.5 comes to about **0.03p a word**, so roughly 30 words
per penny and 30p per thousand. The game also stops itself at 200 words a day
per device — Hoot yawns and goes to sleep until tomorrow.

**The prompt is cheap to lengthen.** It is far too short to be cacheable, and
input is a fifth the price of output, so tuning the wording costs almost
nothing. What actually moves the bill is the word cap, which scales with the
reading-age slider.

**Speech is free and is not Anthropic.** The listening and the talking are both
the browser's own, so they never touch the key. Worth knowing: the recogniser
is not on-device — Chrome sends the audio to Google, the same as the tablet's
own dictation does. To improve the voice, download an Enhanced or Premium
English (UK) voice on the device itself: iOS under Settings → Accessibility →
Spoken Content → Voices. It is free and it makes a large difference.

---

## Cloudflare on a machine that has never seen this repo

Two games now have a worker: Dictionary holds the Anthropic key, and the
Equine Dentist Academy holds the children's casebooks and the Director's
password. Neither can be deployed by cloning the repo alone, and that is the
point — a clone gives somebody the code, not the account.

What travels in the repo is everything that is not a secret: the worker source,
and for the Academy a `wrangler.jsonc` saying what binds to what. What does not
travel, and must be done once per machine and once per account:

1. **Authenticate.** `npx wrangler login` opens a browser for you to approve.
   The token is cached in `~/.wrangler`, outside the repo, so nothing is ever
   committed. One login covers every worker, not one per game.
2. **Create the store**, if this is a fresh Cloudflare account rather than a
   fresh laptop. `npx wrangler kv namespace create ACADEMY` prints an id; paste
   it into `wrangler.jsonc`. The id is not a credential — it names a namespace
   inside an account, and is worthless without the login above.
3. **Deploy.** `npx wrangler deploy` from the game's folder.
4. **Set the password.** `npx wrangler secret put DIRECTOR_PASSWORD`, then type
   it. This is the only step that cannot be automated and should not be: it is
   a secret, it lives on Cloudflare, and it is deliberately absent from every
   file here. See the Secrets rule in CLAUDE.md for why that is not negotiable.

Claude can do steps 2 and 3 unattended once `.claude/settings.json` carries the
wrangler permission rules, which are committed. It cannot do 1 or 4: signing in
and typing a password are yours, and no amount of setup changes that.

Dictionary's worker predates this and is still deployed by pasting into the
dashboard, which is why it has no `wrangler.jsonc`. That works from a tablet,
which the CLI does not, so it has not been changed for the sake of matching.

---

## If Claude is ever unavailable

The one fallback worth knowing: open the repo on github.com and press `.`, which
gives a full editor in the browser with no install, on any device.

    https://github.dev/campbell226/kid-games

Edit the file, then commit and push from its Source Control panel.
