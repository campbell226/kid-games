# Murmuration → Android TV screensaver: porting brief

> **For James.** Create the project in Android Studio with **Television →
> No Activity**, name *Murmuration*, package
> `io.github.campbell226.murmuration`, Kotlin, minimum SDK **API 26**,
> Kotlin DSL. Put this file in the project's root folder as
> `MURMURATION.md`, open Claude Code there and say: *"Read MURMURATION.md
> and follow it. Plan first."* Everything below is written to that Claude,
> not to you.

---

## 0. Your job, in one paragraph

Port **Murmuration**, a browser toy, to an **Android TV screensaver** (a
`DreamService`), in Kotlin. A flock of several hundred starlings wheels over
a reed bed while a dusk sky slowly cycles through its colours. Gusts of wind
sweep across the reeds, and a soft generative soundtrack plays. The web
version took many rounds of tuning with James watching it on a real
screen. The numbers in here are the result of that tuning, not first
guesses. **Port behaviour exactly first, then adapt for TV.** Do not "improve"
constants until James has seen the faithful port running on his TV.

## 1. Ground truth

- **Reference implementation:** one self-contained HTML file, about 1,350
  lines of plain JavaScript with no libraries:
  `https://raw.githubusercontent.com/campbell226/kid-games/main/games/murmuration/murmuration.html`
  Fetch it and keep it open while you work. **Where this document and the file
  disagree, the file wins**, and tell James about the disagreement.
- **Running version** (open it on a laptop to see and hear the target):
  `https://campbell226.github.io/kid-games/games/murmuration/murmuration.html`
- The second `<script>` block is the game; the first is a full-screen helper
  you can ignore.

## 2. Working with James

- British English in everything he reads.
- He often works from a phone or tablet. Keep replies short, and put the
  substance in files. When you need a decision, offer tappable options
  rather than open questions.
- **Plan first and wait** for anything beyond a small tweak. A message is
  cheaper than a rebuild.
- **You cannot see or hear the TV. James is your eyes and ears.** Anything
  about look, feel or sound only reaches you if he says it. Ask him
  specific questions ("does the wind sound like a buzz or a whoosh?") rather
  than "does it look OK?".
- When you change something, say what changed and what knock-on effects to
  watch for. Don't describe the file.

## 3. What it is, and what must survive the port

The feel is **calm**. It is meant to be relaxing. Everything was tuned
towards that, and these are the qualities James has explicitly approved:

1. **The flock looks like a real murmuration.** It forms commas, ribbons,
   sheets and teardrops, splits into parties that rejoin, and sometimes
   sweeps low over the water. It never flies off screen and never settles
   into a static ball.
2. **Birds are seen in 3D from the ground.** High birds mostly show their
   undersides, low birds are side-on, and banking birds tilt. Wings beat in
   bursts with glides between. The whole flock shimmers dark and light as it
   wheels.
3. **The sky drifts slowly round a dusk palette.** It goes gold, peach, rose,
   lilac, blue hour, pale and back, about 4½ minutes a lap. It lingers on
   each colour and never jumps.
4. **Wind comes as separate gusts.** You can see each one travel left to
   right across the reeds, and hear it at the same moment, panned with it.
   There is stillness between gusts. When it is calm, it is near silent.
5. **The music is a slow pad of pure tones** drifting between chords that
   share notes, with an occasional far-off chime. It must never buzz (see
   §14 and §16).
6. **A disturbance scatters the birds.** They burst outwards at once, keep
   away from the spot for a few seconds while a faint circle shows exactly
   the avoided area and fades in step with their wariness, then drift back
   in their own time. On the web this was a tap. On TV there is no touch:
   see §12 for how disturbances arise on their own.

## 4. Decisions

### Already made for the TV build

- **Platform:** Android TV / Google TV, landscape 16:9 only, `DreamService`.
- **Language:** Kotlin. Use a single `app` module, Views (no Compose
  needed), and no game engine.
- **Non-interactive dream** (`isInteractive = false`), so any remote button
  wakes the TV as users expect.
- **Project:** James created it with Android Studio's *Television → No
  Activity* template:
  - package `io.github.campbell226.murmuration`
  - **minSdk 26**, so it covers essentially every Android TV in use
  - Kotlin DSL Gradle files

  It starts empty, so add every activity, service and resource yourself.

### Open: ask James before building (tappable options)

1. **Sound default:** off, with a setting to turn it on (the usual choice for
   screensavers); on at low volume; or on. *Recommend: on at low volume,
   with a setting.* He loves the music, but a TV suddenly making sound when
   it goes idle can surprise.
2. **Flurries** (§12), the automatic scatters that replace taps: off,
   occasional (every 25–70 s) or frequent (every 10–30 s). *Recommend:
   occasional.*
3. **Show the circle on flurries:** yes or no. *Recommend: no.* On a
   screensaver a circle appearing from nowhere has nothing to explain it.
4. **Which TV or streaming box he has** (make and model). That decides how
   the screensaver gets switched on (§5) and what hardware to expect (§7).

## 5. Android architecture

### Files (suggested)

```
app/src/main/
  AndroidManifest.xml
  java/io/github/campbell226/murmuration/
    MurmurationDream.kt      DreamService: hosts SkyView, starts/stops audio
    PreviewActivity.kt       launcher activity hosting the same SkyView (testing)
    SettingsActivity.kt      leanback preferences (sound, volume, flurries, circle)
    SkyView.kt               View: frame loop, layout, draw order
    Palette.kt               dusk colours, mix(), smoothstep
    Weather.kt               weather cycle, gusts, windAt()
    Scenery.kt               trees, reeds, bank, clouds (build + draw)
    Flock.kt                 bird state arrays, neighbour grid, step(), startle, scares
    BirdRenderer.kt          3D attitude → triangles/paths per depth bucket
    Synth.kt                 AudioTrack thread, voices, filters, reverb, limiter
    Dsp.kt                   Biquad, PinkNoise, Smoother, Freeverb, panner
  res/xml/dream_info.xml
  res/drawable/banner.xml    320×180 TV banner (see §15)
```

### Manifest essentials

```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />

<application android:banner="@drawable/banner" ...>
  <service
      android:name=".MurmurationDream"
      android:exported="true"
      android:label="@string/app_name"
      android:permission="android.permission.BIND_DREAM_SERVICE">
    <intent-filter>
      <action android:name="android.service.dreams.DreamService" />
      <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
    <meta-data android:name="android.service.dream"
               android:resource="@xml/dream_info" />
  </service>

  <activity android:name=".PreviewActivity" android:exported="true"
            android:screenOrientation="landscape">
    <intent-filter>
      <action android:name="android.intent.action.MAIN" />
      <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
      <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
  </activity>

  <activity android:name=".SettingsActivity" android:exported="true" />
</application>
```

`res/xml/dream_info.xml`:

```xml
<dream xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="io.github.campbell226.murmuration/.SettingsActivity" />
```

### DreamService lifecycle

```kotlin
class MurmurationDream : DreamService() {
    private lateinit var sky: SkyView
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isInteractive = false
        isFullscreen = true
        isScreenBright = true
        sky = SkyView(this)
        setContentView(sky)
    }
    override fun onDreamingStarted() { super.onDreamingStarted(); sky.start() }   // frame loop + audio
    override fun onDreamingStopped() { sky.stop(); super.onDreamingStopped() }   // stop both at once
    override fun onDetachedFromWindow() { sky.release(); super.onDetachedFromWindow() }
}
```

`PreviewActivity` hosts the same `SkyView`. It is how James and you will
test without waiting for the screensaver, and it should behave identically.

### Getting it onto the TV: tell James this, it is not obvious

- **Google TV** (Chromecast with Google TV, Google TV Streamer, most new
  TVs) **does not list third-party screensavers** in its settings. The
  established workaround, used by the open-source *Aerial Views* app (worth
  reading as prior art for a TV dream), is adb:
  ```
  adb shell settings put secure screensaver_components io.github.campbell226.murmuration/.MurmurationDream
  ```
  and to undo it, put back the value read beforehand with
  `adb shell settings get secure screensaver_components`. **Have James read
  and note the original value first.**
- Enabling adb on the TV: Settings → System → About → press *Android TV OS
  build* seven times → Developer options → turn on USB/network debugging.
  Then `adb connect <tv-ip>:5555`, or `adb pair` on newer devices that use
  wireless debugging.
- To start the current screensaver immediately for testing (works on many
  devices, not all): `adb shell am start -n com.android.systemui/.Somnambulator`.
- Plain Android TV (non-Google-TV) usually lists it under Settings → Device
  Preferences → Screen saver.
- Verify all of this on James's actual device and tell him what worked.

## 6. Coordinates and layout (`layout()` in the reference)

- `W`, `H` are view size in **pixels**, and `U = min(W, H)`, which is 1080 on
  a 1080p TV. **Every size is a multiple of U**, so the look is
  resolution-independent. The web code worked in CSS pixels; on Android just
  use real pixels. The few absolute minimums (line widths of 0.5, 1 and 1.5
  px; tree step ≥ 2 px; bank step ≥ 3 px) can stay as pixels.
- `horizonY = 0.87 H`. The vanishing point is `(vpx, horizonY)` with `vpx = W/2`.
- The **bird world** is measured in units of U, with origin at the screen's
  top-left: x right, y **down**, z away from the viewer.
  - `xMin = 0.12`, `xMax = W/U − 0.12`, `yMin = 0.15`, `yMax = 0.8 H / U`
    (the flock may come right down to the reed tops).
  - `DEPTH = 0.6`, perspective constant `PK = 0.7 / DEPTH`, and
    `persp(z) = 1 / (1 + z·PK)`, so far birds are drawn at about 0.59×.
  - Projection to the screen:
    `s = persp(z)`, `SX = vpx + (x·U − vpx)·s`, `SY = horizonY + (y·U − horizonY)·s`.
- On a resize, rescale bird x and y proportionally into the new bounds; see
  the reference. TV rarely resizes, but keep it.
- Neighbour grid cell = `R` (0.08 world units),
  `gcols = ceil(W/U/R) + 1`, `grows = ceil(H/U/R) + 1`.

## 7. Frame loop, timing and performance

- Drive the loop with `Choreographer.postFrameCallback`, or
  `postInvalidateOnAnimation()` with time measured in `onDraw`.
  `dt = clamp(seconds since last frame, 0.001, 0.05)`.
- Order per frame: `updateSky`, `updateWind`, `updateHome`, `flock.step`,
  `draw`, then hand gust values to the audio thread.
- **Never allocate in the frame loop.** Use preallocated `FloatArray`s for
  all bird state (`MAX = 800`), reused `Path`s (`rewind()`), cached `Paint`s,
  and small fixed pools for gusts and scares.
- Keep clocks (sky, weather, home, flow, reed phase) as **`Double`**. A
  screensaver runs for hours, and `Float` time loses precision.
- **Bird count:** start with `n = clamp(round(W·H/800), 400, 800)`, which
  gives 800 at 1080p. **Adaptive thinning** (reference `frame()`): every 2 s
  window, if the average *work* time per frame exceeds 11 ms, count a slow
  window. After two slow windows in a row, `n = max(200, round(n·0.8))`.
  Ignore any single frame over 50 ms (that's the system, not us). Birds
  never come back mid-session. On Android, HWUI renders on a separate thread,
  so also watch **actual frame intervals** from Choreographer. If they
  average more than 1.25× the display's refresh period over two windows,
  thin the same way.
- TV hardware is modest; a Chromecast with Google TV has a 4×A55 CPU and a
  Mali-G31. **Measure on James's device early** (milestone 2) and report the
  frame time to him.

## 8. Sky colour cycle

Six keyframes per row, as (top of sky, middle, horizon, glow):

| # | name | top | mid | horizon | glow |
|---|------|-----|-----|---------|------|
| 0 | gold | `#7d97c4` | `#e3b48f` | `#f8d69c` | `#fff0c0` |
| 1 | peach | `#6a78b4` | `#e79c8a` | `#f9c79a` | `#ffd9b0` |
| 2 | rose | `#555a9c` | `#c98aa6` | `#f4a98f` | `#ffc0a0` |
| 3 | lilac | `#434a8a` | `#9580b2` | `#e3a3a8` | `#f7b7b0` |
| 4 | blue hour | `#323a78` | `#646aa6` | `#b89abb` | `#dcb0c6` |
| 5 | pale | `#48679a` | `#93b1c2` | `#e6d9ba` | `#fff2cc` |

- `INK = #15111c`, used for birds and silhouettes.
- `SEG = 45` s per keyframe. The lap is 270 s, and the clock starts at a
  random point in the lap. With reduced motion (§15), the clock runs at
  half speed.
- `k = floor(clock/SEG)`, `f = smoothstep((clock − k·SEG)/SEG)`, and each
  colour is a per-channel linear mix of row k and row (k+1) mod 6.
  `smoothstep(t) = t·t·(3 − 2t)`, which makes it linger on each keyframe.
- `mix(a, b, t)` is per-channel linear RGB. Everything below uses it.

## 9. Weather and gusts (`updateWind`, `windAt`)

- **Weather** (how often and how hard it gusts) cycles like the sky:
  `WEATHER = [0.05, 0.4, 0.15, 0.75, 0.3, 0.95, 0.1, 0.55]` with 28 s per
  step, smoothstep between steps and a random start.
- **Gusts** (at most a few alive). Each has `pos` (screen widths, starting
  at −0.45), `speed` (`0.32 + rand·0.13` screen widths/s) and
  `peak = clamp(weather·(0.55 + 0.7·rand), 0.05, 1)`.
  - `nextGust` starts at 3 s and counts down. When it reaches zero: if any
    gust has `pos < 0.75`, wait 1 s more (**gusts never overlap**).
    Otherwise spawn one, and set
    `nextGust = (12 − 6·weather)·(0.75 + 0.75·rand)`.
  - Each frame: `pos += speed·dt`, and remove the gust when `pos > 1.5`.
- **Heard:** `on = peak·exp(−((pos − 0.5)/0.38)²)`. Sum over gusts to get
  `heard`, then `gustHeard = clamp(heard, 0, 1)` (drives the wind sound) and
  `windPan = clamp(Σ on·(pos − 0.5) / heard, −0.5, 0.5)`, or 0 if heard < 0.01.
- `windHeard = clamp(weather·0.12 + heard, 0, 1)` drives the reeds' flutter
  speed: `reedPhase += dt·(1.1 + 2.6·windHeard)`.
- **Local wind** at screen fraction fx:
  `windAt(fx) = clamp(weather·0.12 + Σ peak·exp(−((fx − pos)/0.3)²), 0, 1.2)`.
- These numbers were tuned so that wind is heard only 3–28% of the time,
  never for more than about 2.5 s at once. Earlier versions were continuous,
  and James found them loud and distracting.

## 10. Scenery

All scenery is generated from a **seeded** generator (mulberry32, in the
reference `seeded()`), so the same screen size always grows the same marsh.
Trees use seed 7; reeds and bank share seed 11, consumed in this order:
back row, front row, bank.

```
mulberry32: seed = (seed + 0x6D2B79F5) | 0
            t = imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 2^32
```

(Kotlin: use `Int` arithmetic, which wraps like `imul`, with `ushr` for
`>>>`. Convert the final value with `toUInt().toDouble() / 4294967296.0`.)

**Tree line** (`buildTrees`). There are `round(W/U·7) + 3` clumps, each with
x = rnd·W, w = U·(0.03 + rnd·0.07) and h = U·(0.012 + rnd·0.035). Step
along x = −step to W + 2·step with `step = max(2, 0.006U)`:
`h = 0.006U + sin(0.05x)·0.002U`, raised to `clump.h·sqrt(1 − d²)` inside
any clump (`d = (x − cx)/w`), plus `(rnd − 0.5)·0.004U` jitter. The point is
`(x, horizonY − h)`. Fill the polygon down to `horizonY + 3` with
`mix(INK, mix(top, hor, 0.5), 0.42)`.

**Water.** A vertical gradient from horizonY to H, running from
`mix(hor, INK, 0.2)` to `mix(mid, INK, 0.65)`.

**Reeds** (`makeRow`, `buildReeds`), with `marsh = H − horizonY`:
- Back row: spacing 0.016U, height `marsh·(0.45 + 0.4·rnd^1.4)`, colour
  `mix(INK, top, 0.3)`, line width `max(1, 0.0024U)`.
- Front row: spacing 0.034U, height `marsh·(0.6 + 0.65·rnd^1.4)`, colour
  `mix(INK, top, 0.12)`, line width `max(1, 0.003U)`.
- Each reed (rnd calls in this order):
  - `lean = (rnd − 0.5)·0.18`
  - h as above
  - `ph = rnd·2π`
  - `plume = U·(0.022 + 0.02·rnd)`
  - `pw = U·(0.003 + 0.002·rnd)`
  - `droop = sign(lean)·(0.7 + 0.7·rnd)`
  - `leaf = rnd < 0.6 ? rnd − 0.5 : 0`

  Then `x += spacing·(0.5 + rnd)`. The start is `x = −spacing·rnd`, before
  the loop.
- Drawing each frame (`drawRow`):
  - `local = windAt(x/W)`, or `windHeard` with reduced motion.
  - `ang = lean + 0.45·local + sin(reedPhase + ph + 0.01x)·(0.012 + 0.07·local)`.
    Drop the sine term with reduced motion.
  - Stalk: a quadratic from `(x, H+2)` with control `(x + sin(ang)·h·0.3, H − h/2)`
    to the top `(x + sin(ang)·h, H − cos(ang)·h)`.
  - Optional leaf: from `(x + sin(ang)·0.12h, H − 0.35h)`, a quadratic with
    control offset `(leaf·0.4h, −0.22h)`, ending at offset `(leaf·0.62h, −0.04h)`.
  - Stroke all stalks and leaves in one path with round caps.
  - Plume: an ellipse with radii `(plume/2, pw)` at angle
    `pa = ang − π/2 + droop`, then streamed downwind:
    `pa += (0.35 − pa)·clamp(0.9·local, 0, 0.85)`. Its centre is
    `top + (cos pa, sin pa)·0.42·plume`. Fill all plumes in one path. On
    Android, build each ellipse as a ~12-point polygon in the path, rather
    than a save/rotate/drawOval per plume.
- **Bank.** Step along x with `step = max(3, 0.008U)` to make points
  `(x, H − marsh·(0.24 + 0.05·sin(0.013x) + 0.05·rnd))`. Fill down to H+2 in
  the front-reed colour.

**Glow.** A radial gradient at `(0.7W, horizonY)` with radius
`0.55·max(W, H)`, from glow at alpha 0.55 to transparent, over the sky rect.

**Clouds.** Four soft ellipses, given as `{x, y, w, h, v, a}`:
`{0.2, 0.2, 0.55, 0.035, 0.004, 0.28}`, `{0.7, 0.34, 0.8, 0.03, 0.0028, 0.22}`,
`{0.45, 0.5, 0.6, 0.025, 0.0036, 0.2}`, `{0.9, 0.66, 0.9, 0.02, 0.002, 0.26}`.
- Centre `(x·W, y·horizonY)`, radii `(w·W/2, h·H)`.
- A radial gradient from `mix(hor, glow, 0.5)` at alpha `a` to 0.
- Drift `x += v·dt·(0.4 + 2.2·weather)`, ×0.3 with reduced motion. Wrap when
  `x − w/2 > 1.05` to `x = −w/2 − 0.05`.

**Draw order:**
1. Sky gradient (0 → horizonY, stops top / mid at 0.55 / hor)
2. Glow
3. Clouds
4. Water
5. Tree line
6. Back reeds
7. **Birds**
8. Front reeds
9. Bank
10. Circles (§12)

The front reeds go over the birds, so a low flock passes behind the plumes.

Gradient shaders only need rebuilding when colours have moved. Recreate
them at most every ~100 ms, not every frame.

## 11. The flock (`Flock.step`)

### State per bird (arrays of length MAX)

- Position `px, py, pz` and velocity `vx, vy, vz` (world units, units/s).
- Acceleration scratch `AX, AY, AZ`.
- Smoothed sideways acceleration `LX, LY, LZ`, used for banking.
- Wing beat `phase`, a burst timer `flapT`, and a `flapping` flag.
- `size` (0.85–1.15).
- `panic` and `panicNext`.
- Screen projection `SX, SY, SS`, and a depth `bucket`.

### Constants

| name | value | meaning |
|---|---|---|
| CRUISE, VMIN, VMAX | 0.2, 0.12, 0.3 | speeds (units/s) |
| R, SEP | 0.08, 0.034 | neighbour radius, separation radius |
| W_ALI, W_COH, W_SEP | 1.6, 1.4, 0.9 | alignment, cohesion, separation |
| W_HOME, W_GATHER | 0.12, 0.25 | pull to wandering home, pull to flock centre |
| W_EDGE | 8 | soft walls (each wall's push capped at 1.5) |
| W_FLEE | 10 | push away from a disturbance |
| MAXNB | 10 | neighbours counted for alignment/cohesion |
| ACC_MAX | 1.6 | acceleration cap when calm (+9·panic when frightened) |
| NOISE | 0.25 | random acceleration per axis (±0.125) |
| FLOW | 0.14 | strength of the invisible current |
| LEVEL | 1.2 | damping of vertical speed (birds prefer level flight) |

With reduced motion, multiply CRUISE, VMIN, VMAX and the flow clock rate by 0.6.

### Spawn

The flock arrives from off the left:
- `px = xMin − 0.15 − 0.5·rand`
- `py = yMin + 0.3·(yMax − yMin) + (rand − 0.5)·0.35`
- `pz = DEPTH·(0.3 + 0.4·rand)`
- `vx = CRUISE·(0.9 + 0.2·rand)`, with vy and vz `(rand − 0.5)·0.05`
- `flapping` with 60% chance, `flapT = rand`, `phase = rand·2π`, and
  everything else zero.

### Home

A wandering target the flock wheels round (`updateHome`; `homeT` runs ×0.6
with reduced motion):

```
cx = (xMin + xMax)/2,  cy = (yMin + yMax)/2
home.x = cx + (xMax − xMin)·0.32·sin(0.071·homeT)
home.y = cy + (yMax − yMin)·0.34·sin(0.113·homeT + 1.3)
home.z = DEPTH·(0.5 + 0.32·sin(0.049·homeT + 0.4))
```

Then, for each live scare (§12), convert its screen point to world space at
`home.z` (`s = persp(home.z)`, `wx = (vpx + (sx − vpx)/s)/U`, and likewise
wy). If home lies within `0.7·left(scare)` of it, push home out to that
distance. Finally clamp home into the bounds. `homeT` starts random.

### Step

Port this literally; it is the heart of the thing.

```
flowT += dt·spd                                // spd = 0.6 if reduced else 1
build grid: bucket each bird by floor(px/R), floor(py/R), clamped; also mean position (mx,my,mz)
collect disturbances: held points (r = FR, s = 1, held) and live scares (r = SR, s = left, not held);
    wary = max(1 if any held, left of each scare)
gather = W_GATHER·(1 − 0.8·wary)

for each bird i:
  scan the 3×3 grid cells around it; for each other bird j within R (3D distance):
    if cnt < MAXNB: cnt++, sum vj into avg velocity, sum (pj − pi) into offset
    if d < SEP (and d² > 1e-12): sep −= (pj − pi)/d · (1 − d/SEP)
    pmax = max(pmax, panic[j])
  p = panic[i]
  if cnt > 0:
    a += (avgV − vi)·W_ALI·(1 + p)
    a += offset/cnt · W_COH, with the y component doubled (flattens the flock into sheets)
  a += sep·W_SEP
  a.y −= vy·LEVEL
  a.x += (sin(7.1y + 0.23·flowT) + sin(8.3z − 0.17·flowT))·FLOW
  a.y +=  sin(6.7x − 0.19·flowT)·FLOW·0.5
  a.z += (sin(7.7x + 0.21·flowT) + sin(5.3y + 0.29·flowT))·FLOW
  hk = cnt > 2 ? W_HOME : 3·W_HOME;    a += clamp((home − p)·hk, ±0.3) per axis
  gk = cnt > 2 ? gather : 2·gather;    a += clamp((mean − p)·gk, ±0.3) per axis
  soft walls: x < xMin → a.x += min(1.5, (xMin − x)·W_EDGE); similarly xMax, yMin, yMax, z < 0, z > DEPTH
  disturbances, in SCREEN space (s = persp(z), scrX/scrY as in §6):
    for each, if dist < r: k = max(0, 1 − dist/r)            // the max() matters, see §16
       push = (held ? k : sqrt(k))·W_FLEE·s_strength
       a.xy += (scr − point)/(dist + 0.001)·push
       if held: scared = max(scared, k)
  a += (rand − 0.5)·NOISE per axis
  store a
  panicNext = max(0, p − 0.8·dt)
  if 0.75·pmax > panicNext: panicNext += (0.75·pmax − panicNext)·min(1, 12·dt)   // alarm ripples outward
  if scared > panicNext: panicNext = scared

for each bird i:
  q = panicNext[i]; panic[i] = q
  cap |a| at ACC_MAX + 9q
  ov = v;  v += a·dt
  speed: sp = |v|; want = CRUISE·(1 + 0.9q)
         ns = clamp(sp + (want − sp)·min(1, 0.8·dt), VMIN, VMAX·(1 + 1.5q));  v *= ns/sp
  p += v·dt
  HARD depth stop: if z < −0.1 → z = −0.1, vz = max(vz, 0);  if z > DEPTH + 0.15 → clamp, vz = min(vz, 0)
  NaN safety net: if any of p or v is NaN → p = home, v = (CRUISE, 0, 0), ov = v, panic = 0, L = 0
  banking input: t = (v − ov)/dt;  remove its component along v;  L += (t − L)·min(1, 4·dt)
  flapT −= dt; when ≤ 0 toggle flapping, flapT = flapping ? 0.5 + 1.1·rand : 0.3 + 0.9·rand
  if flapping or q > 0.2: phase += dt·2π·(6 + 6q)
```

`FR = 0.24U` is a held disturbance's radius. `SR = 1.4·FR` is a scare's radius.

## 12. Disturbances: startle, scares and the circle

On the web a finger caused these. On TV, **flurries** cause them (§4, open
decision 2). A flurry behaves exactly like a quick tap.

- **Startle** (`startle(x0, y0)`, screen px) happens at the instant of the
  disturbance, so the effect is immediate. Here `near = 1.7·FR`,
  `far = 1.3U` and `spd` is 0.6 when reduced. For each bird, `d` = its
  screen distance (+0.001) and `dir` = unit vector away from the point:
  - If `d < near`: `k = 1 − d/near`, `v.xy += dir·(0.3 + 0.7k)·0.5·spd`,
    `panic = max(panic, 0.3 + 0.5k)`, and count it as *hit*.
  - Else if `d < far`: `k = 1 − d/far`, `v.xy += dir·k·0.1·spd`,
    `panic = max(panic, 0.2k)`.
  - Return the hit count; the wing sound uses it.
- **Scare.** Where the disturbance "lifts", add `{x, y, life = 6 s, r}` and
  keep at most 8. `left = smoothstep(clamp(life/6, 0, 1))`. It repels with
  the `sqrt(k)` falloff inside SR (§11), weakens the flock-centre pull (via
  `wary`) and pushes home away (§11). Measured on the web: the scattered
  spot stays empty about 4 s, then refills over 2–3 s. Before scares
  lingered, birds came back within 1.5 s and it felt wrong.
- **Circle** (`drawMarks`). Only draw it if the setting is on.
  - A held point's ring radius eases towards FR; a scare's eases towards
    SR, via `r += (target − r)·min(1, 7·dt)`, or instantly with reduced
    motion. It starts at `0.25·FR`.
  - Alpha is 0.45 for held points and `0.45·left` for scares.
  - Draw a radial wash from transparent at 0.4r to white at `alpha·0.3` at
    r, then a white ring stroke at `alpha`, width `max(1.5, 0.004U)`.
  - It shows exactly the avoided area and fades exactly as the wariness
    does. Keep those two tied together; James specifically asked for it.
- **Flurry scheduling (TV).**
  - Occasional: every 25–70 s; frequent: every 10–30 s; both random.
  - Target point: pick a random bird's (SX, SY), add a random offset up to
    0.15U, and clamp to the sky area.
  - Then run `startle`, then `whoosh(hit, x)`, then add a scare with
    `r = 0.25·FR`.
  - Never fire within 8 s of the previous one.

## 13. Drawing the birds (`birdPath`, `drawBirds`)

Each bird is a body pointing along its velocity, with wings square to it.
The wings are banked into the turn and beat up and down. It is then
**projected as seen from the ground looking up at it**.

```
base = 0.026U;  span = base·SS·size;  half = span/2;  len = 0.6·span;  bw = 0.08·span
origin (oX, oY) = (SX, SY)

// how steeply you look up at it
h = max(0, horizonY − oY);  foc = 0.75H;  hyp = sqrt(h² + foc²)
ce = foc/hyp;  se = h/hyp
screen offset of a 3D vector (x, y, z) = (x,  y·ce + z·se)

f = v / |v|                                       // forward
L = (LX, LY, LZ)·4, capped at length 2.5           // BANK = 4, BANK_MAX = 2.5
u = L + (0, −1, 0);  u −= (u·f)f;  normalise (if |u| < 1e-4 use (0, 0, 1))   // up, leaning into the turn
r = f × u                                         // right wing direction

a = 0.06 (glide)  or  0.15 + 0.75·sin(phase) if (flapping or panic > 0.2) and not reduced
ca = cos(a)·half;  sa = sin(a)·half

for side in (+1, −1):  w = r·side
   shoulder front = f·0.10·len + w·bw
   tip            = w·ca + u·sa − f·0.27·len
   shoulder back  = −f·0.12·len + w·bw
   → one triangle (project each point)

body: nose = f·0.5·len, tail = −f·0.47·len, projected.
   If the projected nose→tail length < 2·bw, the bird is end-on:
       draw a diamond of radius bw at the origin.
   Else: draw a spindle nose → (35% along) + perpendicular·bw → tail → (35% along) − perpendicular·bw.
```

- **Depth buckets:** `bucket = clamp(floor(z/DEPTH·4), 0, 3)`. Draw far to
  near (3 → 0). Colour is `mix(INK, haze, [0, 0.14, 0.28, 0.42][bucket])`
  with `haze = mix(mid, hor, 0.35)`.
- **Hairline:** each bucket is filled **and** stroked with
  `width = max(0.5, base·persp((b + 0.5)/4·DEPTH)·0.04)` and round joins, so
  a wing seen exactly edge-on still shows as a line.
- **Winding:** on the web every triangle is emitted with the same winding
  (reversed if its signed area is positive), so that overlapping wing and
  body add up under non-zero fill instead of punching holes. If you use
  `Path`, keep this. If you use triangles via `drawVertices`, winding does
  not matter.
- **Android rendering choice.** Start with one `Path` per bucket (fill +
  stroke, antialiased Paint, `Paint.Join.ROUND`), which mirrors the web
  version exactly. **Measure on the TV.** If bird drawing costs more than
  about 6 ms a frame, switch to `Canvas.drawVertices(TRIANGLES)`: 4
  triangles per bird, one call per bucket with the Paint's colour. Add
  `drawLines` for the hairlines (each wing's shoulder→tip, and nose→tail).
  Note that `drawVertices` is not antialiased; look at it on the TV and ask
  James. The last resort is GLES 2 with 4× MSAA for the birds only.

## 14. Sound

### Shape of the audio engine

- Run one `AudioTrack` (`ENCODING_PCM_FLOAT`, stereo, 48 kHz,
  `USAGE_MEDIA` / `CONTENT_TYPE_MUSIC`) on a dedicated thread. Write blocks
  of about 512 frames, with a buffer of 2–4× the minimum.
- Generate everything per sample in Kotlin, with no allocation in the loop.
  This replaces Web Audio. The graph below is the reference's, node for node.
- The UI thread publishes `gustHeard` and `windPan` (`@Volatile` floats, at
  least every 50 ms), plus whoosh events through a small lock-free queue.
- Stop audio immediately in `onDreamingStopped`. Honour the Sound and Volume
  settings; scale the master by the volume setting.

### The graph

```
pad notes ─► padBus(0.5) ─► lowpass 900 Hz ± 350 Hz LFO(0.045 Hz), Q 0.5dB ─┬─► master
                                                                            └─► reverb
bells ─► bellBus(1.0) ─┬─► dry 0.3 ─► master
                       └─► reverb
reverb ─► out gain 0.5 ─► master
wind: pink ─► highpass 320 Hz (Q 0.5dB) ─► bandpass (600 + 1400·gustHeard) Hz, Q 0.5 ─► gain ─► pan(windPan) ─► master
whoosh: pink ─► highpass 320 Hz ─► bandpass (enveloped) ─► gain (enveloped) ─► pan ─► master
master: gain fades 0.0001 → 0.6 exponentially over 4 s at start ─► compressor (−18 dB, 4:1) ─► out
```

### Voices

- **Chords**, in MIDI note numbers:
  - D add9 `[50, 57, 64, 66]`
  - Bm7 `[47, 54, 57, 62]`
  - Gmaj7 `[43, 50, 59, 66]`
  - Asus `[45, 52, 59, 64]`
  - Em9 `[52, 59, 62, 66]`

  The progression is indices `[0, 1, 2, 3, 0, 4, 2, 3]`, looping. A new
  chord starts every **10 s** and each lasts **16 s**, so they overlap.
  `f = 440·2^((m − 69)/12)`.
- **Pad note.** A sine at f plus a sine at 2f with gain 0.22, under one
  envelope:
  - level 0.16 if MIDI < 50, else 0.13
  - linear rise from 0.0001 to the level over 0.35·len
  - hold until 0.55·len
  - linear fall to 0.0001 at len

  **Pure sines only.** See §16 on bees.
- **Bell.** The first comes at 6–12 s, then every 6–14 s. MIDI is a random
  choice from `[74, 76, 78, 81, 83, 86]`. A sine at f plus a sine at 2f
  with gain 0.18. The envelope rises exponentially from 0.0001 to 0.05 in
  0.04 s, then falls exponentially to 0.0001 at 4 s.
- **Wind.** Pink noise, filtered as in the graph. Gain is
  `0.0001 + 0.2·gustHeard^1.8`, smoothed with a 0.15 s time constant; the
  bandpass centre is smoothed at 0.15 s and the pan at 0.2 s. There is no
  steady breeze in the sound, only gusts. It must sit well under the music.
- **Whoosh** (wings, on a startle):
  - Skip it if `hit < 3`, or if the last whoosh was under 0.2 s ago.
  - `k = clamp(hit/(0.3n), 0.25, 1)`.
  - Bandpass centre: 500 Hz, exponential to `1100 + 900k` at 0.15 s, then
    exponential to 450 at 1.1 s.
  - Gain: 0.0001, exponential to `0.25 + 0.45k` at 0.1 s, then exponential
    to 0.0001 at 1.2 s.
  - Pan `clamp((x/W − 0.5)·1.2, ±0.8)`.
  - Read the shared pink-noise source from a random offset, or just run
    another pink generator.

### DSP details (the Web Audio behaviours to match)

- **Biquads** use the RBJ cookbook, as Web Audio does, with
  `w0 = 2πf/fs`. Careful: in Web Audio, **lowpass and highpass Q are in
  dB**, so `α = sin(w0)/(2·10^(Q/20))`, and Q 0.5 dB is a linear Q of about
  1.06. **Bandpass Q is linear**, so `α = sin(w0)/(2Q)`, and Q 0.5 is very
  wide. Bandpass is the constant-0-dB-peak form: `b0 = α, b1 = 0, b2 = −α`.
  Recompute coefficients when the frequency moves; once per 32–64-sample
  block is fine.
- **Pink noise:** Paul Kellet's filter, exactly as in the reference
  `pinkBuffer` (coefficients b0…b6, output ×0.11). Generate it live; you
  don't need the looped buffer.
- **Exponential ramp:** `v(t) = v0·(v1/v0)^((t − t0)/(t1 − t0))`.
  `setTargetAtTime` is a one-pole lag: `v += (target − v)·(1 − e^(−Δt/τ))`.
- **Panner:** Web Audio's StereoPanner on a mono input is equal-power:
  `x = (pan + 1)/2`, `L = cos(x·π/2)`, `R = sin(x·π/2)`.
- **Reverb:** the web uses a 3.5 s convolution with stereo noise decaying as
  `(1 − t)^2.4`, normalised. That is too heavy per sample in Kotlin. Use an
  algorithmic reverb instead, **Freeverb** (8 combs + 4 allpasses per
  channel): room around 0.85, damping around 0.4, wet only (the 0.5 return
  is applied after). Tune it with James so the pad and bells have a long,
  soft tail of roughly 3 s.
- **Compressor:** threshold −18 dB, ratio 4, attack 3 ms, release 250 ms,
  soft knee. A simple feed-forward envelope follower is enough. It mostly
  just catches chord overlaps.
- TV speakers, like phone speakers, cannot reproduce low frequencies. Test
  on the TV's own speakers as well as a soundbar.

## 15. TV-specific requirements

- **Burn-in (OLED TVs).** A screensaver may run for hours, and the
  silhouettes along the bottom are static. Add a **pixel orbit**: translate
  the whole drawing by up to ±6 px on a slow Lissajous with a period of
  about 10 minutes, applied as one `canvas.translate`. Overdraw the edges by
  6 px so no gap shows.
- **Reduced motion.** Android has no `prefers-reduced-motion`. Treat
  `Settings.Global.ANIMATOR_DURATION_SCALE == 0` (*Remove animations*) as
  reduced. In reduced mode:
  - The sky runs at half speed and home at 0.6×.
  - Bird speeds are 0.6×, and there is no wing beating.
  - Reeds lean but don't flutter, and gusts don't travel (`windHeard`
    everywhere).
  - Clouds drift at 0.3×.
  - Circles appear at full size with no expansion.
- **Settings** (`SettingsActivity`, `androidx.leanback:leanback-preference`
  so the D-pad works):
  - Sound on/off
  - Volume (low / medium / high)
  - Flurries (off / occasional / frequent)
  - Show circles on flurries
- **Banner** (required for the TV launcher): 320×180 dp. It shows a dusk
  gradient, a dark comma-shaped flock of tiny "v" birds and a reed
  silhouette along the bottom. The web launcher tile in
  `https://raw.githubusercontent.com/campbell226/kid-games/main/index.html`
  (the `mu-` SVG) is the design to copy as a vector drawable. App name:
  **Murmuration**.
- **Remove these web-only parts:**
  - the full-screen button
  - audio unlocking on first touch
  - the touch/pointer handlers (unless James later wants an interactive
    version, in which case they map to D-pad or touch)
  - visibility handling, which the dream lifecycle replaces

## 16. Lessons learned the hard way. Do not regress these.

1. **Bees.** Detuned oscillators, or triangle/saw waves, on low pad notes
   beat several times a second, and a dozen at once sounds like a swarm.
   Use pure sines only, with no detune.
2. **Wind that hums.** Noise through a *low*-pass sounds like a drone on
   small speakers. The only part they can play is a narrow slice that
   hums. Wind and whoosh use the highpass + wide bandpass described above.
3. **Wind that never stops.** The wind is gusts only: brief, quiet, never
   overlapping, with nothing between them.
4. **Birds snapping back.** Without lingering scares, a weakened centre
   pull and home repulsion, the flock refilled a scattered spot within about
   a second. The centre of a scattered ring *is* the scattered spot.
5. **The perspective singularity.** `persp(z)` divides by zero at
   `z = −1/PK ≈ −0.857`. A whole flock heading towards the viewer can drift
   there. Hence the hard depth stop at −0.1.
6. **NaN contagion.** One NaN bird spreads to every neighbour through
   alignment and cohesion until the sky is empty. Guard `sqrt` arguments
   (`k = max(0, …)`) and keep the per-bird NaN reset.
7. **Edge-on wings vanish** without the hairline stroke.
8. **Overlapping fills cancel** without consistent winding (Path rendering
   only).
9. **The scatter was too violent at first.** The kick factor is 0.5, not
   0.8; keep the softened values.
10. **Reeds were too prominent and birds too small at first.** Keep the
    reed heights and spacings, `base = 0.026U`, and the `yMax = 0.8H` floor.
11. **Thinning the flock on one slow frame** shrank it needlessly. Keep the
    50 ms outlier rule and the two-window requirement.

## 17. Build order. Stop and show James after each milestone.

1. **Skeleton.** Project, manifest, DreamService, PreviewActivity and
   SkyView drawing the sky gradient, cycling. Give James the adb commands
   and get it running as his screensaver on the real TV. *Check: does it
   show up and dismiss on a button press?*
2. **Scenery and flock.** Trees, water, reeds (static), and the flock with
   the full step, drawn as the 3D birds. Measure and report frame time and
   bird count on the TV. *Check: does it look like the web version?*
   (James can open the web link on a laptop beside the TV.)
3. **Weather.** Gusts bending reeds, clouds drifting, pixel orbit.
4. **Sound.** Pad, bells, reverb, then wind, then whoosh. *Check with
   James: no buzz, wind quiet and gusty, music as he remembers it.*
5. **Flurries, circles and settings,** then the banner.
6. **Long run.** Leave it running for an hour or more. Check memory is flat
   (Android Studio profiler), there is no stutter and no NaN resets
   (log them), and that audio stops instantly on wake.

**Acceptance:**
- Indistinguishable in feel from the web version, side by side.
- Holds a steady frame rate on James's TV.
- Silent when Sound is off.
- Dismisses on any button.
- Settings work with the D-pad.
- No allocation churn in steady state.
