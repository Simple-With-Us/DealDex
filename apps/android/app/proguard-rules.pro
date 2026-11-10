# R8 keep rules for the release build.
#
# R8 is enabled here for the first time, in the same change that adds
# androidx.security:security-crypto.  That combination needs care: Tink (which
# backs EncryptedSharedPreferences) registers its key managers REFLECTIVELY over
# shaded protobuf types, and R8 in full mode strips them.  The failure mode is
# nasty rather than loud — `EncryptedSharedPreferences.create` throws, Prefs
# falls back, and the credential store degrades silently.  Prefs now falls back
# to memory rather than a plaintext file (see Prefs.kt), but the right answer is
# to not strip Tink in the first place.

# --- Tink / EncryptedSharedPreferences ---
-keep class com.google.crypto.tink.** { *; }
-keep class com.google.crypto.tink.shaded.protobuf.** { *; }
-keepclassmembers class * extends com.google.crypto.tink.shaded.protobuf.GeneratedMessageLite {
  <fields>;
}
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.api.client.http.**
-dontwarn org.joda.time.**
-dontwarn javax.annotation.**

# --- Ours: models are read reflectively out of org.json in Market/AccountApi ---
-keep class me.grok.dealdex.data.** { *; }

# Keep line numbers so a Play Console stack trace is still readable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Sentry ships consumer ProGuard rules in the AAR.  Explicit keep here
# for the integrations added in PR #3 of the MM comprehensive review
# (SentryOkHttpIntegration, FragmentLifecycleIntegration,
# SentryComposeIntegration).  These integrations are reflectively wired
# via ServiceLoader, so R8 would otherwise strip them in the release
# build and tracing would silently degrade to crash-only.
-keep class io.sentry.okhttp.** { *; }
-keep class io.sentry.android.fragment.** { *; }
-keep class io.sentry.compose.** { *; }
-keep class io.sentry.android.core.** { *; }
-keep class io.sentry.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepclassmembers class * {
    @io.sentry.SentryTransaction <methods>;
    @io.sentry.SentryTrace <methods>;
    @io.sentry.SentrySpan <methods>;
}
