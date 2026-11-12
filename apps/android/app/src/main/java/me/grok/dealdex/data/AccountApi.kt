package me.grok.dealdex.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object AccountApi {
    private val http = OkHttpClient.Builder()
        .applySentryTracing()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()
    private val json = "application/json; charset=utf-8".toMediaType()

    data class Session(val token: String, val email: String)
    data class Keys(val justTcg: String, val priceCharting: String, val pokemonTcg: String)

    private fun post(url: String, body: String, token: String? = null): Pair<Int, String> {
        val b = Request.Builder().url(url).post(body.toRequestBody(json))
            .header("Accept", "application/json")
            .header("User-Agent", "DealDex/1.0 (android)")
        if (!token.isNullOrBlank()) b.header("Authorization", "Bearer $token")
        http.newCall(b.build()).execute().use { res ->
            return res.code to (res.body?.string().orEmpty())
        }
    }

    private fun get(url: String, token: String): Pair<Int, String> {
        val req = Request.Builder().url(url).get()
            .header("Accept", "application/json")
            .header("Authorization", "Bearer $token")
            .header("User-Agent", "DealDex/1.0 (android)")
            .build()
        http.newCall(req).execute().use { res ->
            return res.code to (res.body?.string().orEmpty())
        }
    }

    // `signIn(email, password)` used to live here.  It POSTed credentials to
    // /api/native/session, which the server has answered with 410 Gone since
    // email/password sign-in was removed.  Nothing called it.  Sign-in goes
    // through NativeAuth (Google/Apple/X + PKCE code exchange).

    fun pullKeys(origin: String, token: String): Keys {
        val (code, raw) = get("$origin/api/native/keys", token)
        if (code == 401) throw RuntimeException("Session expired. Sign in again.")
        if (code >= 400) throw RuntimeException("Could not load keys ($code)")
        val o = JSONObject(raw.ifBlank { "{}" })
        return Keys(o.optString("justtcg"), o.optString("pricecharting"), o.optString("pokemontcg"))
    }

    fun pushKeys(origin: String, token: String, keys: DeskKeys) {
        val payload = JSONObject()
            .put("justtcg", keys.justTcg)
            .put("pricecharting", keys.priceCharting)
            .put("pokemontcg", keys.pokemonTcg)
            .toString()
        val (code, raw) = post("$origin/api/native/keys", payload, token)
        if (code >= 400) {
            val err = JSONObject(raw.ifBlank { "{}" }).optString("error", "Push failed ($code)")
            throw RuntimeException(err)
        }
    }
}
