import Foundation
import Sentry

/// Native Sentry crash reporting and telemetry for DealDex iOS.
enum SentryTelemetry {
    static func start() {
        let dsn = (Bundle.main.object(forInfoDictionaryKey: "SENTRY_DSN") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        // Match web: stay dark when no DSN is configured.  A hardcoded ingest
        // URL would phone home from every Simulator and CI archive.
        guard !dsn.isEmpty else { return }

        SentrySDK.start { options in
            options.dsn = dsn
            let version = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let build = (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !version.isEmpty {
                options.releaseName = build.isEmpty ? version : "\(version)+\(build)"
            }
            #if DEBUG
            options.environment = "development"
            #else
            options.environment = "production"
            #endif
            options.tracesSampleRate = 0.2
            // sentry-cocoa 9.x removed Options.profilesSampleRate.  Profiling
            // is now configured through SentryProfileOptions, and .trace keeps
            // the old behaviour of profiling sampled traces.
            options.configureProfiling = { profiling in
                profiling.lifecycle = .trace
                profiling.sessionSampleRate = 0.1
            }
            options.enableAppHangTracking = true
            options.appHangTimeoutInterval = 2.0
            options.enableCaptureFailedRequests = true
            options.failedRequestStatusCodes = [HttpStatusCodeRange(min: 500, max: 599)]
            options.attachScreenshot = false
            options.attachViewHierarchy = false
            options.sendDefaultPii = false
            options.sessionReplay.sessionSampleRate = 0.1
            options.sessionReplay.onErrorSampleRate = 1.0
            options.sessionReplay.maskAllText = true
            options.sessionReplay.maskAllImages = true
            options.beforeSend = { event in
                if let request = event.request, let url = request.url {
                    var sanitized = url
                    for param in ["token", "key", "secret", "auth", "password"] {
                        sanitized = sanitized.replacingOccurrences(
                            of: "([?&]\(param)=)[^&#\\s]+",
                            with: "$1[REDACTED]",
                            options: .regularExpression
                        )
                    }
                    request.url = sanitized
                }
                return event
            }
        }
    }
}
