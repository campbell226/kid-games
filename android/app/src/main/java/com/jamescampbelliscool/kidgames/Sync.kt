package com.jamescampbelliscool.kidgames

import android.content.Context
import android.net.Uri
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Keeps the phone's copy of the games in step with main on GitHub, so a push
 * reaches the app without reinstalling it.
 *
 * The app carries a snapshot of index.html and games/ taken when it was built
 * (assets/site, listed in assets/site.json). Anything main has changed since
 * is downloaded into an overlay, which Site looks in first. Git names every
 * file by a hash of its contents, so a file is only fetched when its hash
 * differs from the one held, and a download is only kept if its hash proves
 * it is the file that was asked for. Every changed file is fetched before any
 * is swapped in, so a dropped connection leaves the old set whole.
 */
object Sync {
    private const val TAG = "KidGames"
    private const val REPO = "campbell226/kid-games"
    private const val BRANCH = "main"

    // Launching the app or waking the screen asks again, but no more often
    // than this. When nothing has changed, the question is one tiny request
    // that GitHub does not count against its hourly allowance.
    private const val GAP_MS = 2 * 60 * 1000L

    private val running = AtomicBoolean(false)
    @Volatile private var lastTry = 0L

    fun overlayDir(context: Context) = File(context.filesDir, "overlay")
    private fun stateFile(context: Context) = File(context.filesDir, "overlay.json")
    private fun stagingDir(context: Context) = File(context.filesDir, "staging")

    /** Must agree with what the bundleSite task in app/build.gradle.kts copies. */
    private fun inSite(path: String) = path == "index.html" || path.startsWith("games/")

    /**
     * An overlay is only good on top of the snapshot it was laid over. When
     * the app is reinstalled with a different snapshot, that snapshot is newer
     * than anything the overlay holds, so start again from it.
     */
    fun prepare(context: Context) {
        val snapshot = snapshotId(context)
        if (readState(context).optString("snapshot") == snapshot) return
        overlayDir(context).deleteRecursively()
        writeState(context, JSONObject().put("snapshot", snapshot).put("files", JSONObject()))
    }

    fun maybeRun(context: Context) {
        val now = System.currentTimeMillis()
        if (now - lastTry < GAP_MS || !running.compareAndSet(false, true)) return
        lastTry = now
        val app = context.applicationContext
        thread(name = "sync", isDaemon = true) {
            try {
                run(app)
            } catch (e: Exception) {
                // Offline, rate limited, or GitHub having a moment: keep what
                // is here and try again next time.
                Log.i(TAG, "sync stopped: $e")
            } finally {
                running.set(false)
            }
        }
    }

    private fun run(context: Context) {
        val state = readState(context)
        val held = state.optJSONObject("files") ?: JSONObject()

        // Which commit is main on? The answer is a bare hash, and when it is
        // the same as last time GitHub just says so.
        val head = fetch(
            "https://api.github.com/repos/$REPO/commits/$BRANCH",
            "application/vnd.github.sha",
            state.optString("etag").ifEmpty { null },
        )
        if (head.code == 304) return
        val commit = String(head.body).trim()
        if (commit == state.optString("commit")) {
            writeState(context, state.put("etag", head.etag ?: ""))
            return
        }

        // Every file in that commit, with the hash git knows it by.
        val tree = JSONObject(String(fetch(
            "https://api.github.com/repos/$REPO/git/trees/$commit?recursive=1",
            "application/vnd.github+json",
        ).body))
        if (tree.optBoolean("truncated")) throw IOException("file list too long to come in one go")
        val entries = tree.getJSONArray("tree")
        val bundled = bundled(context)

        val staging = stagingDir(context)
        staging.deleteRecursively()
        val changed = sortedMapOf<String, String>()
        for (i in 0 until entries.length()) {
            val entry = entries.getJSONObject(i)
            val path = entry.getString("path")
            if (entry.getString("type") != "blob" || !inSite(path)) continue
            val sha = entry.getString("sha")
            if (sha == (held.optString(path).ifEmpty { null } ?: bundled[path])) continue

            val url = "https://raw.githubusercontent.com/$REPO/$commit/" +
                path.split('/').joinToString("/") { Uri.encode(it) }
            val bytes = fetch(url, null).body
            if (blobSha(bytes) != sha) throw IOException("$path did not match its hash")
            File(staging, path).apply { parentFile?.mkdirs() }.writeBytes(bytes)
            changed[path] = sha
        }

        val overlay = overlayDir(context)
        for ((path, sha) in changed) {
            val dest = File(overlay, path)
            dest.parentFile?.mkdirs()
            if (!File(staging, path).renameTo(dest)) throw IOException("could not put $path in place")
            held.put(path, sha)
        }
        writeState(context, state.put("files", held).put("commit", commit).put("etag", head.etag ?: ""))
        staging.deleteRecursively()
        Log.i(TAG, "synced to $commit: ${changed.size} file(s) changed")
    }

    private class Reply(val code: Int, val body: ByteArray, val etag: String?)

    private fun fetch(url: String, accept: String?, etag: String? = null): Reply {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 10_000
            c.readTimeout = 20_000
            c.setRequestProperty("User-Agent", "kid-games-android")
            if (accept != null) c.setRequestProperty("Accept", accept)
            if (etag != null) c.setRequestProperty("If-None-Match", etag)
            val code = c.responseCode
            if (code == 304) return Reply(code, ByteArray(0), etag)
            if (code != 200) throw IOException("$url answered $code")
            return Reply(code, c.inputStream.use { it.readBytes() }, c.getHeaderField("ETag"))
        } finally {
            c.disconnect()
        }
    }

    @Volatile private var bundledCache: Map<String, String>? = null

    private fun bundled(context: Context): Map<String, String> = bundledCache ?: run {
        val json = JSONObject(String(siteJson(context)))
        json.keys().asSequence().associateWith { json.getString(it) }.also { bundledCache = it }
    }

    private fun siteJson(context: Context) = context.assets.open("site.json").use { it.readBytes() }

    private fun snapshotId(context: Context) = hex(MessageDigest.getInstance("SHA-1").digest(siteJson(context)))

    // What git names a file by: the SHA-1 of a short header and its bytes.
    private fun blobSha(bytes: ByteArray): String {
        val md = MessageDigest.getInstance("SHA-1")
        md.update("blob ${bytes.size}\u0000".toByteArray())
        return hex(md.digest(bytes))
    }

    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }

    private fun readState(context: Context): JSONObject = try {
        JSONObject(stateFile(context).readText())
    } catch (e: Exception) {
        JSONObject()
    }

    private fun writeState(context: Context, state: JSONObject) {
        val file = stateFile(context)
        val temp = File(file.path + ".new")
        temp.writeText(state.toString())
        if (!temp.renameTo(file)) throw IOException("could not save sync state")
    }
}
