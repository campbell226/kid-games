package com.jamescampbelliscool.kidgames

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** Android's text-to-speech, behind the page's speechSynthesis. */
class Mouth(context: Context, private val tell: (JSONObject) -> Unit) {

    private val context = context.applicationContext
    private var tts: TextToSpeech? = null
    private var ready = false
    private var failed = false
    private var ranked = emptyList<Voice>()

    // Asked for before the engine had started, which takes a moment.
    private val waiting = mutableListOf<(Boolean) -> Unit>()

    // Bumped by hush, so speech queued while the engine was still starting
    // is not said once it has.
    private var generation = 0

    private fun whenReady(job: (Boolean) -> Unit) {
        if (ready || failed) {
            job(ready)
            return
        }
        waiting += job
        if (tts != null) return
        tts = TextToSpeech(context) { status ->
            ready = status == TextToSpeech.SUCCESS
            failed = !ready
            if (ready) setUp()
            val jobs = waiting.toList()
            waiting.clear()
            jobs.forEach { it(ready) }
        }
    }

    private fun setUp() {
        val tts = tts ?: return
        // As loud as the games' other sounds, on the same volume buttons.
        tts.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String) = tell(about("start", id))
            override fun onDone(id: String) = tell(about("end", id))

            @Deprecated("Superseded by the version with an error code.")
            override fun onError(id: String) = tell(failure(id, "synthesis-failed"))

            override fun onError(id: String, code: Int) = tell(failure(id, errorName(code)))

            override fun onStop(id: String, interrupted: Boolean) =
                tell(failure(id, if (interrupted) "interrupted" else "canceled"))

            override fun onRangeStart(id: String, start: Int, end: Int, frame: Int) =
                tell(about("boundary", id).put("at", start).put("len", end - start))
        })
        rank()
    }

    // Installed voices only, the phone's own before the ones that need the
    // internet, then the phone's chosen voice, then the best sounding. The
    // order matters: a game looking for "an English voice" takes the first.
    private fun rank() {
        val tts = tts ?: return
        val default = tts.defaultVoice
        ranked = tts.voices.orEmpty()
            .filter { TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features }
            .sortedWith(compareBy({ it.isNetworkConnectionRequired }, { it != default }, { -it.quality }, { it.name }))
    }

    fun listVoices() = whenReady { ok ->
        if (ok) rank()
        val default = tts?.defaultVoice
        val list = JSONArray()
        for (v in ranked) {
            list.put(
                JSONObject()
                    .put("id", v.name)
                    .put("name", v.name)
                    .put("lang", v.locale.toLanguageTag())
                    .put("local", !v.isNetworkConnectionRequired)
                    .put("isDefault", v == default)
            )
        }
        tell(JSONObject().put("t", "voices").put("list", list))
    }

    fun speak(id: String, text: String, lang: String, voiceName: String, rate: Float, pitch: Float, volume: Float) {
        val asked = generation
        whenReady { ok ->
            val tts = tts
            when {
                asked != generation -> tell(failure(id, "canceled"))
                !ok || tts == null -> tell(failure(id, "synthesis-unavailable"))
                else -> {
                    val voice = ranked.firstOrNull { it.name == voiceName } ?: best(lang)
                    if (voice != null) tts.voice = voice
                    tts.setSpeechRate(rate.coerceIn(0.1f, 4f))
                    tts.setPitch(pitch.coerceIn(0.1f, 2f))
                    val params = Bundle().apply {
                        putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume.coerceIn(0f, 1f))
                    }
                    val words = text.take(TextToSpeech.getMaxSpeechInputLength())
                    if (tts.speak(words, TextToSpeech.QUEUE_ADD, params, id) != TextToSpeech.SUCCESS) {
                        tell(failure(id, "synthesis-failed"))
                    }
                }
            }
        }
    }

    private fun best(lang: String): Voice? {
        if (lang.isEmpty()) return null
        val want = Locale.forLanguageTag(lang)
        return ranked.firstOrNull { it.locale.language == want.language && it.locale.country == want.country }
            ?: ranked.firstOrNull { it.locale.language == want.language }
    }

    fun hush() {
        generation += 1
        if (ready) tts?.stop()
    }

    fun shutdown() {
        tts?.shutdown()
        tts = null
        ready = false
    }

    private fun about(type: String, id: String) = JSONObject().put("t", type).put("id", id)

    private fun failure(id: String, error: String) = about("error", id).put("error", error)

    private fun errorName(code: Int) = when (code) {
        TextToSpeech.ERROR_NETWORK, TextToSpeech.ERROR_NETWORK_TIMEOUT -> "network"
        TextToSpeech.ERROR_OUTPUT -> "audio-hardware"
        TextToSpeech.ERROR_NOT_INSTALLED_YET -> "voice-unavailable"
        TextToSpeech.ERROR_INVALID_REQUEST -> "invalid-argument"
        else -> "synthesis-failed"
    }
}
