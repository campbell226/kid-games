package com.jamescampbelliscool.kidgames

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import java.io.File
import kotlin.system.exitProcess

/**
 * Stands in for MainActivity for a moment while GpuWatch replaces its
 * process. It runs in a process of its own (":restart" in the manifest),
 * opens on top of MainActivity in the same task, ends the old process, and
 * opens MainActivity again, which starts it in a new one.
 *
 * The same task matters: a pinned app may not start a new one, and a task
 * whose only activity dies goes with it.
 */
class Restart : Activity() {

    private val main = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val old = intent.getIntExtra(OLD_PID, 0)
        if (old > 0 && old != Process.myPid()) Process.killProcess(old)
        val giveUp = System.currentTimeMillis() + 3_000

        // MainActivity would come back in the old process if it were still
        // there, so wait for it to be gone first.
        main.post(object : Runnable {
            override fun run() {
                if (old > 0 && File("/proc/$old").exists() && System.currentTimeMillis() < giveUp) {
                    main.postDelayed(this, 50)
                    return
                }
                startActivity(Intent(this@Restart, MainActivity::class.java))
                finish()
                // Nothing else lives in this process.
                main.postDelayed({ exitProcess(0) }, 1_000)
            }
        })
    }

    companion object {
        const val OLD_PID = "old-pid"
    }
}
