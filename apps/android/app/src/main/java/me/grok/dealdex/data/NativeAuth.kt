package me.grok.dealdex.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * Native sign-in, PKCE-style.
 *
 * The return leg lands on `dealdex://auth`, and a custom scheme is NOT exclusive
 * on Android: any installed app may register the same intent filter and receive
 * (or race for) that redirect. It used to carry the live Better Auth session
 * token, so interception meant account takeover.
 *
 * Now the redirect carries a single-use code. Redeeming it requires the verifier
 * generated here and kept in encrypted storage, so a hijacker gets a value it
 * cannot spend.
 */
object NativeAuth {
    const val DEFAULT_ORIGIN = "https://dealdex.net"

    private val http = OkHttpClient.Builder().applySentryTracing().build()
    private val random = SecureRandom()

    fun normalized(origin: String): String {
        var s = origin.trim().trimEnd('/')
        if (s.isEmpty()) return DEFAULT_ORIGIN
        if (!s.contains("://")) s = "https://$s"
        return s
    }

    private fun b64url(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)

    private fun newVerifier(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return b64url(bytes)
    }

    private fun challengeFor(verifier: String): String =
        b64url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))

    /**
     * Open the website's sign-in. Stores the verifier first: the browser round
     * trip can outlive this process, so it has to survive a restart.
     */
    fun start(context: Context, prefs: Prefs, origin: String, provider: String) {
        val site = normalized(origin)
        val verifier = newVerifier()
        prefs.authVerifier = verifier
        val uri = Uri.parse("$site/api/native/oauth")
            .buildUpon()
            .appendQueryParameter("provider", provider)
            .appendQueryParameter("challenge", challengeFor(verifier))
            .build()
        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
    }

    /**
     * Redeem the code the redirect carried. Blocking — call it off the main
     * thread.
     */
    fun complete(prefs: Prefs, uri: Uri, origin: String): AccountApi.Session {
        val err = uri.getQueryParameter("error")
        if (!err.isNullOrBlank()) throw RuntimeException(err.replace("_", " "))

        val code = uri.getQueryParameter("code")
        if (code.isNullOrBlank()) throw RuntimeException("Sign-in did not complete.  Try again.")

        val verifier = prefs.authVerifier
        if (verifier.isBlank()) throw RuntimeException("Sign-in expired.  Start again from this app.")

        val payload = JSONObject().put("code", code).put("verifier", verifier).toString()
        val req = Request.Builder()
            .url("${normalized(origin)}/api/native/exchange")
            .post(payload.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .header("Accept", "application/json")
            .header("User-Agent", "DealDex/1.0 (android)")
            .build()

        http.newCall(req).execute().use { res ->
            // Single use either way, so never leave a spent verifier behind.
            prefs.authVerifier = ""
            val json = JSONObject(res.body?.string().orEmpty().ifBlank { "{}" })
            if (!res.isSuccessful) {
                throw RuntimeException(json.optString("error", "Sign-in could not be completed."))
            }
            val token = json.optString("token")
            if (token.isBlank()) throw RuntimeException("Sign-in did not complete.  Try again.")
            return AccountApi.Session(token, json.optString("email"))
        }
    }
}
