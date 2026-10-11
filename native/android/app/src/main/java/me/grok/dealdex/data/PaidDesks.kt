package me.grok.dealdex.data

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/** Calls paid valuation APIs directly from the phone. Never goes through DealDex.com. */
object PaidDesks {
    private val http = OkHttpClient.Builder()
        .applySentryTracing()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(16, TimeUnit.SECONDS)
        .build()

    private fun get(url: String, headers: Map<String, String> = emptyMap()): String {
        val b = Request.Builder().url(url).header("Accept", "application/json")
            .header("User-Agent", "DealDex/1.0 (android)")
        headers.forEach { (k, v) -> b.header(k, v) }
        http.newCall(b.build()).execute().use { res ->
            if (!res.isSuccessful) return ""
            return res.body?.string().orEmpty()
        }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun walk(obj: Any?, keys: Set<String>, depth: Int = 0): Double? {
        if (obj == null || depth > 4) return null
        if (obj is JSONObject) {
            val it = obj.keys()
            while (it.hasNext()) {
                val k = it.next()
                val v = obj.opt(k)
                if (k in keys) {
                    val n = when (v) {
                        is Number -> v.toDouble()
                        is String -> v.replace(Regex("[^0-9.]"), "").toDoubleOrNull()
                        else -> null
                    }
                    if (n != null && n > 0 && n < 1_000_000) return if (n > 500 && "price" in k) n / 100 else n
                }
            }
            val it2 = obj.keys()
            while (it2.hasNext()) {
                walk(obj.opt(it2.next()), keys, depth + 1)?.let { return it }
            }
        }
        return null
    }

    fun blend(card: TcgCard, keys: DeskKeys): Double? {
        val found = mutableListOf<Double>()
        if (keys.justTcg.isNotBlank()) justTcg(card, keys.justTcg)?.let { found += it }
        if (keys.priceCharting.isNotBlank()) priceCharting(card, keys.priceCharting)?.let { found += it }
        if (keys.pokemonTcg.isNotBlank()) pokemonTcg(card, keys.pokemonTcg)?.let { found += it }
        return if (found.isEmpty()) null else found.average()
    }

    private fun justTcg(card: TcgCard, key: String): Double? {
        val q = enc("${card.name} ${card.setName}")
        val raw = get("https://api.justtcg.com/v1/cards?game=pokemon&q=$q&limit=3", mapOf("x-api-key" to key))
        if (raw.isBlank()) return null
        return try {
            val o = JSONObject(raw)
            val data = o.optJSONArray("data")
            if (data == null || data.length() == 0) null
            else walk(data.optJSONObject(0), setOf("marketPrice", "market", "price", "avgPrice", "nm"))
        } catch (_: Exception) {
            null
        }
    }

    private fun priceCharting(card: TcgCard, token: String): Double? {
        val q = enc("${card.name} ${card.setName} pokemon")
        val raw = get("https://www.pricecharting.com/api/product?t=${enc(token)}&q=$q")
        if (raw.isBlank()) return null
        return try {
            val o = JSONObject(raw)
            val product = o.optJSONObject("product") ?: o
            val cents = product.optInt("loose-price", 0)
            if (cents > 0) cents / 100.0 else walk(product, setOf("loose-price", "ungraded-price"))
        } catch (_: Exception) {
            null
        }
    }

    private fun pokemonTcg(card: TcgCard, key: String): Double? {
        val q = enc("name:\"${card.name}\" set.name:\"${card.setName}\"")
        val raw = get("https://api.pokemontcg.io/v2/cards?q=$q&pageSize=1", mapOf("X-Api-Key" to key))
        if (raw.isBlank()) return null
        return try {
            val o = JSONObject(raw)
            val row = o.optJSONArray("data")?.optJSONObject(0) ?: return null
            walk(row.optJSONObject("tcgplayer"), setOf("market"))
        } catch (_: Exception) {
            null
        }
    }
}
