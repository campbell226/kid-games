# Kid Games for Android

A thin wrapper: one full-screen web view showing the games, with no address
bar, no links out to anywhere else, and none of Chrome's toasts.

## How it works

- The app answers every request for `https://kidgames.jamesinthe.uk/…`
  itself, from copies on the phone. The games think they are on the real
  site, so the Dictionary and Academy workers accept them, the microphone
  works, and saved progress lives under the real address.
- It ships with a snapshot of `index.html` and `games/`, taken from this repo
  when it is built, so it works offline from the first launch.
- When it opens, or the screen wakes, it asks GitHub which commit `main` is
  on (at most once every two minutes). If that has moved, it downloads just
  the files that changed, checks each against git's hash, and swaps them in
  together. **A push reaches the app the next time a page loads, with no
  reinstall.** A game that hasn't synced yet is fetched from the live site.
- Back goes from a game to the home screen, and does nothing on the home
  screen itself.
- If the web view's GPU dies under it, the app starts itself again, at most
  once a minute (`GpuWatch.kt`). On the Pixel 6a the web view sometimes loses
  its Vulkan device just as the app comes back to the front, and the screen
  stays white with the page still running behind it. The page can't see
  that, but Chromium logs it on every frame, so the app watches its own log.
  A stand-in screen (`Restart.kt`) holds the app's place while the process
  is replaced, so a pinned app stays pinned, and it comes back on the page it
  was showing. A game's progress survives, except anything saved in the last
  few seconds before the restart.
- Opening the app offers to pin it (Android's screen pinning). To unpin, hold
  Back and Overview together. With gesture navigation, swipe up and hold.
  Turn on *Ask for PIN before unpinning* under Settings → Security → App
  pinning, so the kids can't unpin it themselves.

## Putting it on a phone

The first time, on the phone:

1. Settings → About phone → tap **Build number** seven times.
2. Settings → System → Developer options → switch on **Wireless debugging**
   (same Wi-Fi as Rascal), then tap it → **Pair device with pairing code**.
3. On Rascal, in a terminal, using the address and code the phone shows:

   ```
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" pair 192.168.x.x:PORT
   ```

After that, and for every update to the app itself:

```
./android/install.ps1
```

It finds the phone on the network, builds the app, installs it and opens it.
Wireless debugging switches itself off now and then, so switch it on again
first if the script can't find the phone.

Changes to the games don't need any of this: they arrive by themselves.

## Things to know

- Signed with Rascal's debug key. Building on another machine gives a
  different key, so Android won't install it over the top. Uninstalling
  first works, but loses saved progress.
- Android's web view has no working speech or screen wake lock, so the app
  supplies them under the browser's standard names (`Bridge.kt`,
  `res/raw/bridge.js`). `speechSynthesis` is Android's text-to-speech, which
  works offline with the phone's installed voices. `SpeechRecognition` is the
  phone's on-device recogniser where it has English, else Google's online
  one. `navigator.wakeLock` keeps the screen on. Games use them exactly as
  they would in Chrome.
- If the games ever move to a different domain, `Site.HOST` changes with it,
  just as the workers' allowed-origin lists do.
