package me.grok.dealdex

import android.app.Application
import io.sentry.android.core.SentryAndroid
import io.sentry.android.fragment.FragmentLifecycleIntegration

/**
 * Early Sentry boot.  Card/desk data is not default PII for events —
 * screenshots and view hierarchy stay off.
 *
 * Parity target: matches the iOS + web Sentry feature set.  Profiling,
 * performance tracing, fragment / Compose / OkHttp integrations are all
 * enabled so the dashboard's per-platform comparison lines up cleanly.
 */
class DealDexApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val dsn = BuildConfig.SENTRY_DSN
        if (dsn.isBlank()) return
        SentryAndroid.init(this) { options ->
            options.dsn = dsn
            options.isSendDefaultPii = false
            options.isAttachScreenshot = false
            options.isAttachViewHierarchy = false
            options.tracesSampleRate = 0.2
            options.profilesSampleRate = 0.1
            options.isAnrEnabled = true
            options.isEnableUserInteractionTracing = true
            options.sessionReplay.sessionSampleRate = 0.1
            options.sessionReplay.onErrorSampleRate = 1.0
            options.sessionReplay.setMaskAllText(true)
            options.sessionReplay.setMaskAllImages(true)
            // Wire the same scan-span shape iOS + web already emit.
            options.addIntegration(FragmentLifecycleIntegration(this))
        }
    }
}
