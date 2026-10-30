package com.jamescampbelliscool.kidgames

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.util.Log
import java.util.ArrayDeque
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Starts the app again when the web view's GPU has died under it.
 *
 * On the Pixel 6a the web view's own GPU thread sometimes loses its Vulkan
 * device just as the app comes back to the front: seen on 28 and 30 October
 * 2026, both times within seconds of leaving the app and returning to it.
 * Chromium never recovers from that inside the same process. The page keeps
 * running, but nothing it draws reaches the screen, which stays white until
 * the app is stopped and started again.
 *
 * The page can't tell - it isn't a WebGL context loss - but Chromium says so
 * in the app's log on every frame it fails to draw, and an app may read its
 * own log. So this listens for that line, and when it keeps coming while the
 * app is in front, does what clears it: a fresh process (see Restart), back
 * on the [page] that was showing.
 *
 * To check it still works, log the line from the page eight times at once:
 * console.error('SharedContextState context lost') - the app starts again.
 */
class GpuWatch(private val activity: Activity, private val page: () -> String?) {

    private val main = Handler(Looper.getMainLooper())
    private var reader: java.lang.Process? = null
    private var front = false
    private var restarting = false

    // Lost while out of sight: start again as soon as the app is back.
    private var waiting = false

    fun start() {
        val now = System.currentTimeMillis()
        val since = String.format(Locale.ROOT, "%d.%03d", now / 1000, now % 1000)
        val log = try {
            ProcessBuilder("logcat", "-v", "brief", "-T", since, "--pid=${Process.myPid()}", "-s", "chromium:I")
                .redirectErrorStream(true)
                .start()
        } catch (e: Exception) {
            Log.i(TAG, "GPU watch can't read the log: $e")
            return
        }
        reader = log
        thread(name = "gpu-watch", isDaemon = true) {
            val seen = ArrayDeque<Long>()
            try {
                log.inputStream.bufferedReader().forEachLine { line ->
                    if (MARK !in line) return@forEachLine
                    val t = SystemClock.elapsedRealtime()
                    seen.addLast(t)
                    while (t - seen.first() > WINDOW_MS) seen.removeFirst()
                    if (seen.size >= HITS) {
                        seen.clear()
                        main.post { lost() }
                    }
                }
            } catch (e: Exception) {
                // The log closed under it: stop() was called.
            }
        }
    }

    fun stop() {
        reader?.destroy()
        reader = null
    }

    fun inFront(now: Boolean) {
        front = now
        if (now && waiting) {
            waiting = false
            lost()
        }
    }

    private fun lost() {
        if (restarting) return
        if (!front) {
            waiting = true
            return
        }
        // Never more than once a minute, so a GPU that dies again straight
        // away can't send the app round in circles.
        val prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (now - prefs.getLong("restarted", 0) < GAP_MS) {
            Log.w(TAG, "web view lost its GPU again within a minute; leaving it")
            return
        }
        restarting = true
        prefs.edit().putLong("restarted", now).putString("page", page()).commit()
        Log.w(TAG, "web view lost its GPU; starting the app again")
        stop()
        activity.startActivity(Intent(activity, Restart::class.java).putExtra(Restart.OLD_PID, Process.myPid()))
    }

    companion object {
        /** The page that was showing when the app last started itself again, once. */
        fun takePage(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val page = prefs.getString("page", null) ?: return null
            prefs.edit().remove("page").apply()
            return page
        }

        private const val PREFS = "gpu-watch"
        private const val TAG = "KidGames"

        // Chromium's own words, logged on every frame once the device is gone.
        private const val MARK = "SharedContextState context lost"

        // A real loss logs it about twelve times a second, for as long as the
        // app is in front. Chromium recovering by itself logged it not at all.
        private const val HITS = 5
        private const val WINDOW_MS = 3_000L

        private const val GAP_MS = 60_000L
    }
}
