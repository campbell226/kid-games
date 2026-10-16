package com.jamescampbelliscool.kidgames

import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONException
import org.json.JSONObject

/**
 * Fills in what Android's web view leaves out of a browser - speaking,
 * listening and keeping the screen awake - with the phone's own, under the
 * standard names (speechSynthesis, SpeechRecognition, navigator.wakeLock), so
 * a game written for a browser needs nothing special to run here.
 *
 * res/raw/bridge.js is run before each page's own scripts, on the games' own
 * address only, and is the only thing that can talk to this. All it can ask
 * for is that some text be said, that the microphone listen once, or that the
 * screen stay on.
 */
class Bridge(private val activity: MainActivity, private val web: WebView) {

    private val main = Handler(Looper.getMainLooper())
    private var reply: JavaScriptReplyProxy? = null
    private val mouth = Mouth(activity, ::tell)
    private val ear = Ear(activity, ::tell)
    private val awake = mutableSetOf<String>()

    /** False on a web view too old to offer either half, when games fall back as they would without it. */
    fun install(): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) return false
        val ours = setOf("https://${Site.HOST}")
        WebViewCompat.addWebMessageListener(web, "KidGamesBridge", ours) { _, message, _, isMainFrame, replyProxy ->
            if (isMainFrame) {
                reply = replyProxy
                handle(message.data)
            }
        }
        val script = activity.resources.openRawResource(R.raw.bridge).bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(web, script, ours)
        return true
    }

    private fun handle(data: String?) {
        val m = try {
            JSONObject(data ?: return)
        } catch (e: JSONException) {
            return
        }
        val id = m.optString("id")
        when (m.optString("t")) {
            "voices" -> mouth.listVoices()
            "speak" -> mouth.speak(
                id, m.optString("text"), m.optString("lang"), m.optString("voice"),
                m.optDouble("rate", 1.0).toFloat(), m.optDouble("pitch", 1.0).toFloat(),
                m.optDouble("volume", 1.0).toFloat(),
            )
            "hush" -> mouth.hush()
            "listen" -> ear.listen(id, m.optString("lang"), m.optInt("alts", 1), m.optBoolean("interim"))
            "stop" -> ear.stop(id)
            "abort" -> ear.abort(id)
            "wake" -> wake(id, m.optBoolean("on"))
        }
    }

    // Everything back to the page goes through here. The speech engines
    // answer on threads of their own, and the page is only spoken to from
    // the main one.
    private fun tell(message: JSONObject) {
        main.post { reply?.postMessage(message.toString()) }
    }

    private fun wake(id: String, on: Boolean) {
        if (on) awake += id else awake -= id
        keepScreenOn(awake.isNotEmpty())
    }

    private fun keepScreenOn(on: Boolean) {
        if (on) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    /** A new page, or the app going out of sight: nothing carries over, as in a browser. */
    fun reset() {
        mouth.hush()
        ear.abortAny()
        awake.clear()
        keepScreenOn(false)
    }

    fun shutdown() {
        reset()
        mouth.shutdown()
    }
}
