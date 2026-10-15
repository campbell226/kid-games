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
- Dictionary's Hoot can't speak or listen in the app: Android's web view has
  no speech, so he falls back to a grown-up typing the word.
- If the games ever move to a different domain, `Site.HOST` changes with it,
  just as the workers' allowed-origin lists do.
