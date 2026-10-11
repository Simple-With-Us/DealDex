package me.grok.dealdex.data

import io.sentry.okhttp.SentryOkHttpEventListener
import io.sentry.okhttp.SentryOkHttpInterceptor
import okhttp3.OkHttpClient

/** OkHttp 5 + Sentry 8: wire tracing on every on-device HTTP client. */
internal fun OkHttpClient.Builder.applySentryTracing(): OkHttpClient.Builder =
    eventListener(SentryOkHttpEventListener())
        .addInterceptor(SentryOkHttpInterceptor())
