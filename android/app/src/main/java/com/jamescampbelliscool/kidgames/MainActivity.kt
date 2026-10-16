package com.jamescampbelliscool.kidgames

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher

/**
 * The whole app: one full-screen web view showing the games, with no address
 * bar, no way to wander off to another site, and no browser furniture popping
 * up over the top.
 */
class MainActivity : Activity() {

    private lateinit var root: FrameLayout
    private lateinit var web: WebView
    private lateinit var site: Site
    private lateinit var bridge: Bridge

    // A game's request for full screen. Bridge takes full screen away from
    // the games altogether, so this is only reached on a web view too old for
    // Bridge, where granting it lets the game see it is and put its button away.
    private var fullView: View? = null

    // Whatever wants the microphone - the web view for a game, or the Ear -
    // waiting while Android asks the person.
    private val micWaiting = mutableListOf<(Boolean) -> Unit>()
    private var micRequest: PermissionRequest? = null

    // Offered once each time the app comes to the front, so turning the offer
    // down does not bring it straight back.
    private var askedToPin = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Sync.prepare(this)
        site = Site(this)
        volumeControlStream = AudioManager.STREAM_MUSIC
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Edge to edge, so the game can have the space the bars leave. From
        // Android 15 that is simply how every app is laid out.
        if (Build.VERSION.SDK_INT < 35) {
            @Suppress("DEPRECATION")
            window.setDecorFitsSystemWindows(false)
        }
        window.attributes = window.attributes.apply {
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        }

        root = FrameLayout(this)
        root.setBackgroundColor(NIGHT)
        // Keep the games clear of a camera notch, and of the keyboard when a
        // grown-up is typing a word into Dictionary.
        root.setOnApplyWindowInsetsListener { view, insets ->
            val keep = insets.getInsets(
                WindowInsets.Type.displayCutout() or WindowInsets.Type.systemBars() or WindowInsets.Type.ime()
            )
            view.setPadding(keep.left, keep.top, keep.right, keep.bottom)
            WindowInsets.CONSUMED
        }
        web = makeWeb()
        bridge = Bridge(this, web)
        bridge.install()
        root.addView(web, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        setContentView(root)

        claimBack()
        web.loadUrl(Site.HOME)
    }

    private fun makeWeb() = WebView(this).apply {
        setBackgroundColor(NIGHT)
        overScrollMode = View.OVER_SCROLL_NEVER
        // No text selection, link menus or buzzing from a long press.
        setOnLongClickListener { true }
        isHapticFeedbackEnabled = false
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // The games are laid out for their own sizes, not the phone's
            // font setting.
            textZoom = 100
            setSupportZoom(false)
            builtInZoomControls = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
        }
        webViewClient = Client()
        webChromeClient = Chrome()
    }

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) = site.answer(request)

        // Only the games' own address. Anything else - a link out, a
        // redirect, an app link - goes nowhere.
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = !Site.isOurs(request.url)

        // Speech and wake locks belong to the page that asked for them.
        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) = bridge.reset()

        // A game newer than the phone's copy, with no connection to fetch it:
        // back to the front door rather than a browser error page.
        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame && !Site.isHome(request.url)) view.loadUrl(Site.HOME)
        }

        // The page's process died, which would otherwise take the app with
        // it. Start again with a fresh web view.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            root.removeView(view)
            recreate()
            return true
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (fullView != null) {
                callback.onCustomViewHidden()
                return
            }
            fullView = view
            root.addView(view, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            web.visibility = View.INVISIBLE
            // The web view has just taken Back for itself, to leave full
            // screen. Take it back, so Back still means the front door.
            root.post { claimBack() }
        }

        override fun onHideCustomView() {
            fullView?.let { root.removeView(it) }
            fullView = null
            web.visibility = View.VISIBLE
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            val mic = PermissionRequest.RESOURCE_AUDIO_CAPTURE
            if (!Site.isOurs(request.origin) || mic !in request.resources) {
                request.deny()
                return
            }
            micRequest?.deny()
            micRequest = request
            withMic { granted ->
                if (micRequest !== request) return@withMic
                micRequest = null
                if (granted) request.grant(arrayOf(mic)) else request.deny()
            }
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {
            if (micRequest == request) micRequest = null
        }
    }

    /** Runs [then] with whether the app may use the microphone, asking first if it has not been. */
    fun withMic(then: (Boolean) -> Unit) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            then(true)
            return
        }
        micWaiting += then
        if (micWaiting.size == 1) requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), ASK_MIC)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        if (requestCode != ASK_MIC) return
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        val waiting = micWaiting.toList()
        micWaiting.clear()
        waiting.forEach { it(granted) }
    }

    // Back leaves a game for the front door, and from the front door goes
    // nowhere: it is not a way out of the app.
    private fun back() {
        val here = web.url?.let(Uri::parse)
        if (here != null && Site.isHome(here)) return
        if (web.canGoBack()) web.goBack() else web.loadUrl(Site.HOME)
    }

    // From Android 13, Back arrives as a callback, and the newest one
    // registered wins - so this is called again whenever something else may
    // have registered since. Typed loosely because the class is not there on
    // Android 11 and 12.
    private var backCallback: Any? = null

    private fun claimBack() {
        if (Build.VERSION.SDK_INT < 33) return
        (backCallback as OnBackInvokedCallback?)?.let { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) }
        val callback = OnBackInvokedCallback { back() }
        onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
        backCallback = callback
    }

    // Android 11 and 12, where Back is a key, and a full-screen game's view
    // would otherwise catch it first.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (Build.VERSION.SDK_INT < 33 && event.keyCode == KeyEvent.KEYCODE_BACK && fullView != null) {
            if (event.action == KeyEvent.ACTION_UP) back()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Android 13 and later use the callback registered by claimBack.")
    override fun onBackPressed() {
        back()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideBars()
    }

    // The phone's own bars stay out of the way. A swipe from the edge brings
    // them back for a moment, over the top of the game.
    private fun hideBars() {
        window.insetsController?.apply {
            hide(WindowInsets.Type.systemBars())
            systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        Sync.maybeRun(this)
        if (!askedToPin) {
            askedToPin = true
            pin()
        }
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    // Out of sight, rather than merely paused: Android's own permission
    // question pauses the app, and must not cancel the listening it is for.
    override fun onStop() {
        super.onStop()
        bridge.reset()
        askedToPin = false
    }

    override fun onDestroy() {
        bridge.shutdown()
        web.destroy()
        super.onDestroy()
    }

    // Screen pinning: Android's own lock, which takes a held two-button
    // gesture (and the phone's PIN, if that is switched on) to leave.
    private fun pin() {
        val am = getSystemService(ActivityManager::class.java)
        if (am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE) return
        try {
            startLockTask()
        } catch (e: Exception) {
            // Pinning switched off in Settings, or refused: the app still works.
        }
    }

    private companion object {
        const val NIGHT = 0xFF141D3A.toInt()
        const val ASK_MIC = 1
    }
}
