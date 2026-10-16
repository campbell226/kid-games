package com.jamescampbelliscool.kidgames

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import org.json.JSONArray
import org.json.JSONObject

/**
 * Android's speech recogniser, behind the page's SpeechRecognition.
 *
 * The phone's own on-device recogniser first, so a child's voice stays on the
 * phone. Where that has no English to offer, Google's online one - the same
 * one Chrome would use.
 */
class Ear(private val activity: MainActivity, private val tell: (JSONObject) -> Unit) {

    private var recognizer: SpeechRecognizer? = null
    private var current: String? = null

    // Once the on-device recogniser has said it cannot, stop asking it for
    // as long as the app is open.
    private var onDeviceFailed = false

    fun listen(id: String, lang: String, alts: Int, interim: Boolean) {
        abortAny()
        current = id
        activity.withMic { granted ->
            if (current != id) return@withMic
            if (granted) {
                begin(id, lang, alts, interim, onDevice = canUseOnDevice())
            } else {
                finish(id, "not-allowed")
            }
        }
    }

    private fun canUseOnDevice() = when {
        onDeviceFailed || Build.VERSION.SDK_INT < 31 -> false
        Build.VERSION.SDK_INT >= 33 -> SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)
        else -> true
    }

    private fun begin(id: String, lang: String, alts: Int, interim: Boolean, onDevice: Boolean) {
        val r = try {
            if (onDevice && Build.VERSION.SDK_INT >= 31) {
                SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
            } else if (SpeechRecognizer.isRecognitionAvailable(activity)) {
                SpeechRecognizer.createSpeechRecognizer(activity)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
        if (r == null) {
            if (onDevice) {
                onDeviceFailed = true
                begin(id, lang, alts, interim, onDevice = false)
            } else {
                finish(id, "service-not-allowed")
            }
            return
        }
        recognizer = r
        var heardSpeech = false

        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = tell(about("hearing", id))

            override fun onBeginningOfSpeech() {
                heardSpeech = true
                tell(about("speech", id))
            }

            override fun onEndOfSpeech() = tell(about("quiet", id))

            override fun onPartialResults(partial: Bundle) {
                if (interim && current == id) heard(id, partial, final = false)
            }

            override fun onResults(results: Bundle) {
                if (current != id) return
                if (heard(id, results, final = true)) finish(id, null) else finish(id, "no-speech")
            }

            override fun onError(error: Int) {
                if (current != id) return
                // The on-device recogniser lacking English shows up as an error
                // before anyone has said anything. Quietly ask the other one.
                if (onDevice && !heardSpeech && error in ON_DEVICE_CANNOT) {
                    onDeviceFailed = true
                    drop()
                    begin(id, lang, alts, interim, onDevice = false)
                    return
                }
                finish(id, errorName(error))
            }

            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            if (lang.isNotEmpty()) putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, alts.coerceIn(1, 10))
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, interim)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.packageName)
        })
    }

    // True if there was anything to pass on.
    private fun heard(id: String, bundle: Bundle, final: Boolean): Boolean {
        val words = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        if (words.isEmpty()) return false
        val scores = bundle.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
        val alts = JSONArray()
        words.forEachIndexed { i, text ->
            val score = scores?.getOrNull(i)?.takeIf { it in 0f..1f } ?: 0f
            alts.put(JSONObject().put("text", text).put("confidence", score.toDouble()))
        }
        tell(about("heard", id).put("alts", alts).put("final", final))
        return true
    }

    /** stop(): finish listening and say what was heard. */
    fun stop(id: String) {
        if (current != id) return
        val r = recognizer
        if (r == null) finish(id, null) else r.stopListening()
    }

    /** abort(): finish listening and throw away what was heard. */
    fun abort(id: String) {
        if (current != id) return
        recognizer?.cancel()
        finish(id, "aborted")
    }

    fun abortAny() {
        current?.let { abort(it) }
    }

    private fun finish(id: String, error: String?) {
        if (current != id) return
        current = null
        drop()
        if (error != null) tell(about("deaf", id).put("error", error))
        tell(about("done", id))
    }

    private fun drop() {
        recognizer?.destroy()
        recognizer = null
    }

    private fun about(type: String, id: String) = JSONObject().put("t", type).put("id", id)

    private fun errorName(code: Int) = when (code) {
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_SERVER,
        SpeechRecognizer.ERROR_SERVER_DISCONNECTED, SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> "network"
        SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT, SpeechRecognizer.ERROR_NO_MATCH -> "no-speech"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
            "language-not-supported"
        else -> "aborted"
    }

    private companion object {
        val ON_DEVICE_CANNOT = setOf(
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED,
            SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE,
            SpeechRecognizer.ERROR_SERVER_DISCONNECTED,
            SpeechRecognizer.ERROR_CANNOT_CHECK_SUPPORT,
            SpeechRecognizer.ERROR_CLIENT,
            SpeechRecognizer.ERROR_SERVER,
        )
    }
}
