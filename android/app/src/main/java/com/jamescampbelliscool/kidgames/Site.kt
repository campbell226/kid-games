package com.jamescampbelliscool.kidgames

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException

/**
 * Answers the page's requests for the games' real address from the copies
 * kept on the phone, so the games run offline while still believing they are
 * on the real site. That belief is the point: the Dictionary and Academy
 * workers only answer that origin, the microphone is only offered to an https
 * page, and saved progress belongs to it.
 */
class Site(private val context: Context) {

    fun answer(request: WebResourceRequest): WebResourceResponse? {
        if (request.method != "GET" || !isOurs(request.url)) return null
        val path = pathOf(request.url) ?: return null
        // Not on the phone yet - a game newer than the last sync - so the real
        // site answers instead, if there is a connection.
        val bytes = read(path) ?: return null

        val mime = TYPES[path.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
        val charset = if (mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("xml")) "utf-8" else null
        val headers = mutableMapOf("Accept-Ranges" to "bytes", "Cache-Control" to "no-cache")

        // Audio asks for byte ranges, and is happier given what it asked for.
        val range = rangeOf(request.requestHeaders, bytes.size)
        if (range == null) {
            headers["Content-Length"] = bytes.size.toString()
            return WebResourceResponse(mime, charset, 200, "OK", headers, ByteArrayInputStream(bytes))
        }
        val length = range.last - range.first + 1
        headers["Content-Length"] = length.toString()
        headers["Content-Range"] = "bytes ${range.first}-${range.last}/${bytes.size}"
        return WebResourceResponse(
            mime, charset, 206, "Partial Content", headers,
            ByteArrayInputStream(bytes, range.first, length)
        )
    }

    // Whatever Sync has brought down since the app was built, else the copy
    // the app was built with.
    private fun read(path: String): ByteArray? {
        val synced = File(Sync.overlayDir(context), path)
        if (synced.isFile) {
            try { return synced.readBytes() } catch (e: IOException) { /* fall back to the bundled copy */ }
        }
        return try {
            context.assets.open("site/$path").use { it.readBytes() }
        } catch (e: IOException) {
            null
        }
    }

    private fun rangeOf(headers: Map<String, String>, size: Int): IntRange? {
        val value = headers.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value ?: return null
        val m = Regex("""bytes=(\d*)-(\d*)""").matchEntire(value.trim()) ?: return null
        val (from, to) = m.destructured
        if (size == 0) return null
        if (from.isEmpty()) {
            // "bytes=-500": the last 500.
            val tail = to.toLongOrNull() ?: return null
            if (tail <= 0) return null
            return (size - minOf(tail, size.toLong()).toInt()) until size
        }
        val start = from.toLongOrNull() ?: return null
        if (start >= size) return null
        val end = if (to.isEmpty()) size - 1L else minOf(to.toLongOrNull() ?: return null, size - 1L)
        return if (end < start) null else start.toInt()..end.toInt()
    }

    companion object {
        const val HOST = "kidgames.jamesinthe.uk"
        const val HOME = "https://$HOST/"

        fun isOurs(url: Uri) = url.scheme == "https" && url.host == HOST

        fun isHome(url: Uri) = isOurs(url) && pathOf(url) == "index.html"

        /** "games/x/x.html" for https://HOST/games/x/x.html, "index.html" for the front door. */
        fun pathOf(url: Uri): String? {
            val p = (url.path ?: "/").removePrefix("/")
            val path = if (p.isEmpty() || p.endsWith("/")) p + "index.html" else p
            if ('\\' in path || path.split('/').any { it == ".." || it == "." }) return null
            return path
        }

        private val TYPES = mapOf(
            "html" to "text/html",
            "htm" to "text/html",
            "js" to "text/javascript",
            "mjs" to "text/javascript",
            "css" to "text/css",
            "json" to "application/json",
            "txt" to "text/plain",
            "svg" to "image/svg+xml",
            "png" to "image/png",
            "jpg" to "image/jpeg",
            "jpeg" to "image/jpeg",
            "gif" to "image/gif",
            "webp" to "image/webp",
            "ico" to "image/x-icon",
            "mp3" to "audio/mpeg",
            "wav" to "audio/wav",
            "ogg" to "audio/ogg",
            "m4a" to "audio/mp4",
            "woff" to "font/woff",
            "woff2" to "font/woff2",
            "ttf" to "font/ttf",
        )
    }
}
