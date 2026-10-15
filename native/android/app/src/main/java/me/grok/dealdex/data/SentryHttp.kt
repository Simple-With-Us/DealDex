package me.grok.dealdex.data

import io.sentry.Breadcrumb
import io.sentry.ISpan
import io.sentry.okhttp.SentryOkHttpEventListener
import io.sentry.okhttp.SentryOkHttpInterceptor
import okhttp3.OkHttpClient

/**
 * OkHttp 5 + Sentry 8: wire tracing on every on-device HTTP client.
 *
 * Search terms ride in query strings (`_nkw`, `keyword`, `name`).  Drop those
 * from spans and breadcrumbs.  The path and host stay so a slow hop is still
 * visible.
 */
internal fun OkHttpClient.Builder.applySentryTracing(): OkHttpClient.Builder =
    eventListener(SentryOkHttpEventListener())
        .addInterceptor(
            SentryOkHttpInterceptor { span, _, _ ->
                scrubSentrySpan(span)
                span
            },
        )

internal fun scrubSentrySpan(span: ISpan) {
    span.setData("http.query", null)
    span.setData("http.fragment", null)
    val description = span.description
    if (description != null && description.contains('?')) {
        span.description = description.substringBefore('?')
    }
}

internal fun scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
    breadcrumb.removeData("http.query")
    breadcrumb.removeData("http.fragment")
    val url = breadcrumb.getData("url") as? String
    if (url != null && url.contains('?')) {
        breadcrumb.setData("url", url.substringBefore('?'))
    }
    return breadcrumb
}
