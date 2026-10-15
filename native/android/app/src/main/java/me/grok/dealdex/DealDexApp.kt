package me.grok.dealdex

import android.app.Application
import io.sentry.Sentry
import io.sentry.SentryOptions
import io.sentry.android.core.SentryAndroid
import io.sentry.android.fragment.FragmentLifecycleIntegration
import me.grok.dealdex.data.scrubSentryBreadcrumb

/**
 * Early Sentry boot.  Card and desk data is not default PII for events.
 * Screenshots and view hierarchy stay off, matching iOS.  A view hierarchy
 * would attach card titles from the scan list.
 *
 * Profiling, traces, sessions, logs, NDK, fragment, Compose, and OkHttp
 * match the web and iOS feature set.  Named scan hops live in Market.scan.
 */
class DealDexApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val dsn = BuildConfig.SENTRY_DSN
        if (dsn.isBlank()) return
        SentryAndroid.init(this) { options ->
            options.dsn = dsn
            options.release = "${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
            options.environment = if (BuildConfig.DEBUG) "development" else "production"
            options.isSendDefaultPii = false
            options.isAttachScreenshot = false
            options.isAttachViewHierarchy = false
            options.tracesSampleRate = 0.2
            options.profilesSampleRate = 0.1
            options.isAnrEnabled = true
            options.isEnableNdk = true
            options.isEnableAutoSessionTracking = true
            options.logs.isEnabled = true
            options.isEnableUserInteractionTracing = true
            options.sessionReplay.sessionSampleRate = 0.1
            options.sessionReplay.onErrorSampleRate = 1.0
            options.sessionReplay.setMaskAllText(true)
            options.sessionReplay.setMaskAllImages(true)
            options.beforeBreadcrumb = SentryOptions.BeforeBreadcrumbCallback { breadcrumb, _ ->
                scrubSentryBreadcrumb(breadcrumb)
            }
            options.beforeSend = SentryOptions.BeforeSendCallback { event, _ ->
                val request = event.request
                if (request != null) {
                    val url = request.url
                    if (!url.isNullOrBlank() && url.contains('?')) {
                        request.url = url.substringBefore('?')
                    }
                    request.queryString = null
                }
                event
            }
            options.addIntegration(FragmentLifecycleIntegration(this))
        }
        try {
            Sentry.logger().info("dealdex.android.sentry_ready")
        } catch (_: Throwable) {
            // A log emit must never break boot.
        }
    }
}
