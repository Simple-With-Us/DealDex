package me.grok.dealdex.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

object Market {
    private val http = OkHttpClient.Builder()
        .applySentryTracing()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build()

    private const val JINA = "https://r.jina.ai/"
    private const val TCG = "https://api.tcgdex.net/v2/en"

    private fun get(url: String, accept: String = "text/plain"): String {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", "DealDex/1.0 (android)")
            .header("Accept", accept)
            .build()
        http.newCall(req).execute().use { res ->
            if (!res.isSuccessful) return ""
            return res.body?.string().orEmpty()
        }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    /**
     * Scan eBay and Mercari.
     *
     * ON-DEVICE FIRST, deliberately.  `/privacy` says "the apps scan
     * marketplaces from the device" and "they do not send those keys to DealDex
     * servers" — but this used to call the website FIRST and POST all three paid
     * desk keys with every scan, so the published privacy policy described
     * something the app did not do.
     *
     * The website is a fallback for when the phone cannot reach the marketplaces
     * itself, and it is never given a key.  Paid desks ([PaidDesks.blend]) only
     * ever run here on the device.
     */
    fun scan(
        query: String,
        keys: DeskKeys = DeskKeys(),
        sources: Collection<String> = listOf("ebay", "mercari"),
        origin: String = "https://dealdex.net",
    ): List<ScoredListing> {
        val site = origin.trim().trimEnd('/').ifBlank { "https://dealdex.net" }
        // Top-level Sentry transaction so the dashboard's per-platform scan
        // traces (web + iOS + Android) line up.  Spans inside match the web
        // SCAN_SPAN.* names: scan.ondevice / scan.site.
        val tx = io.sentry.Sentry.startTransaction("scan", "scan")
        return try {
            val onDeviceSpan = tx.startChild("scan.ondevice")
            val rows: List<ScoredListing> = try {
                val out = scanOnDevice(query, keys, sources)
                onDeviceSpan.setData("scan.ondevice.count", out.size)
                out
            } catch (t: Throwable) {
                onDeviceSpan.throwable = t
                onDeviceSpan.setData("scan.ondevice.failed", true)
                emptyList()
            } finally {
                onDeviceSpan.finish()
            }
            if (rows.isNotEmpty()) {
                tx.finish()
                return rows
            }
            val siteSpan = tx.startChild("scan.site")
            val siteRows = try {
                val out = scanViaSite(site, query, sources)
                siteSpan.setData("scan.site.count", out.size)
                out
            } catch (t: Throwable) {
                siteSpan.throwable = t
                siteSpan.setData("scan.site.failed", true)
                emptyList()
            } finally {
                siteSpan.finish()
            }
            tx.finish()
            siteRows
        } catch (t: Throwable) {
            tx.throwable = t
            tx.finish()
            throw t
        }
    }

    private fun scanViaSite(origin: String, query: String, sources: Collection<String>): List<ScoredListing> {
        // No `keys` field.  The endpoint refuses them and the privacy policy
        // says they never leave the phone; both halves have to stay true.
        val payload = JSONObject()
            .put("q", query)
            .put("sources", JSONArray(sources.toList()))
            .toString()
        val req = Request.Builder()
            .url("$origin/api/native/scan")
            .post(payload.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .header("Accept", "application/json")
            .header("User-Agent", "DealDex/1.0 (android)")
            .build()
        http.newCall(req).execute().use { res ->
            val raw = res.body?.string().orEmpty()
            val json = JSONObject(raw.ifBlank { "{}" })
            if (!res.isSuccessful) {
                throw RuntimeException(json.optString("error", "Scan failed (${res.code})"))
            }
            val arr = json.optJSONArray("rows") ?: return emptyList()
            val out = ArrayList<ScoredListing>(arr.length())
            for (i in 0 until arr.length()) {
                parseNativeRow(arr.optJSONObject(i))?.let { out.add(it) }
            }
            return out
        }
    }

    private fun parseNativeRow(obj: JSONObject?): ScoredListing? {
        if (obj == null) return null
        val id = obj.optString("id")
        val title = obj.optString("title")
        if (id.isBlank() || title.isBlank()) return null
        val listing = LiveListing(
            id = id,
            marketplace = obj.optString("marketplace"),
            title = title,
            url = obj.optString("url"),
            price = num(obj, "price"),
            shipping = num(obj, "shipping") ?: 0.0,
            image = obj.optString("image").ifBlank { null },
        )
        val cardObj = obj.optJSONObject("card")
        val card = if (cardObj != null && cardObj.optString("id").isNotBlank()) {
            TcgCard(
                id = cardObj.optString("id"),
                name = cardObj.optString("name"),
                localId = cardObj.optString("localId"),
                setName = cardObj.optString("setName"),
                setId = cardObj.optString("setId"),
                rarity = cardObj.optString("rarity").ifBlank { null },
                image = cardObj.optString("image").ifBlank { null },
                finishes = emptyList(),
                cardmarketEur = null,
            )
        } else null
        val a = obj.optJSONObject("appraisal")
        val appraisal = if (a != null) {
            Appraisal(
                market = num(a, "market"),
                adjusted = num(a, "adjusted"),
                allIn = num(a, "allIn") ?: 0.0,
                spread = num(a, "spread"),
                verdict = a.optString("verdict", "fair"),
            )
        } else null
        return ScoredListing(listing, card, appraisal, obj.optString("grade", "raw"))
    }

    private fun num(o: JSONObject, key: String): Double? {
        if (!o.has(key) || o.isNull(key)) return null
        val d = o.optDouble(key, Double.NaN)
        return d.takeIf { !it.isNaN() }
    }

    private fun scanOnDevice(query: String, keys: DeskKeys, sources: Collection<String>): List<ScoredListing> {
        val q = query.trim()
        val ebayQ = if (Appraise.significantTokens(q).isEmpty()) "pokemon" else
            if (q.contains("pokemon", true) || q.contains("tcg", true)) q else "$q pokemon"
        val mercQ = if (Appraise.significantTokens(q).isEmpty()) "pokemon card" else "$q pokemon card"
        val wantEbay = sources.contains("ebay")
        val wantMercari = sources.contains("mercari")
        val ebayMd = if (wantEbay) get(
            JINA + "https://www.ebay.com/sch/183454/i.html?_nkw=${enc(ebayQ)}&LH_BIN=1&_ipg=60&_udlo=3&_sop=10",
        ) else ""
        val mercMd = if (wantMercari) get(JINA + "https://www.mercari.com/search/?keyword=${enc(mercQ)}") else ""
        val listings = (if (wantEbay) parseEbay(ebayMd, q) else emptyList()) +
            (if (wantMercari) parseMercari(mercMd, q) else emptyList())
        val cache = HashMap<String, List<TcgCard>>()
        val extraCache = HashMap<String, Double?>()
        return listings.map { listing ->
            val name = Appraise.nameQuery(listing.title)
            val grade = Appraise.detectGrade(listing.title)
            val cards = cache.getOrPut(name) { searchCards(name) }
            val card = pickCard(cards, listing)
            val extra = if (card != null && keys.any()) {
                extraCache.getOrPut(card.id) { PaidDesks.blend(card, keys) }
            } else null
            val appraisal = if (card != null && listing.price != null) {
                Appraise.appraise(card, listing, grade, extra)
            } else null
            ScoredListing(listing, card, appraisal, grade)
        }.sortedByDescending { it.appraisal?.spread ?: -99.0 }
    }

    /**
     * Pick the card a listing is actually for.
     *
     * This used to return whichever card's market price sat closest to the
     * listing's own ask — so the ask chose the card, and the card then decided
     * whether the ask was a deal.  Circular, and it hid the underpriced listings
     * the app exists to find.  Now: name evidence, or nothing.
     */
    private fun pickCard(cards: List<TcgCard>, listing: LiveListing): TcgCard? {
        if (cards.isEmpty()) return null
        val q0 = Appraise.significantTokens(Appraise.nameQuery(listing.title)).firstOrNull()
            ?: return null
        val named = cards.filter { it.name.lowercase().contains(q0) }
        if (named.isEmpty()) return null
        val priced = named.filter { it.finishes.any { f -> f.market != null } }
        val use = priced.ifEmpty { named }
        // Deterministic and price-independent.
        return use.minByOrNull { it.id }
    }

    fun searchCards(name: String): List<TcgCard> {
        val raw = get("$TCG/cards?name=${enc(name)}&pagination:itemsPerPage=8", "application/json")
        if (raw.isBlank()) return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until minOf(arr.length(), 8)).mapNotNull { i ->
                val id = arr.getJSONObject(i).optString("id")
                if (id.isBlank()) null else fetchCard(id)
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun fetchCard(id: String): TcgCard? {
        val raw = get("$TCG/cards/${enc(id)}", "application/json")
        if (raw.isBlank()) return null
        return try {
            val o = JSONObject(raw)
            val set = o.optJSONObject("set")
            val pricing = o.optJSONObject("pricing")
            val tcg = pricing?.optJSONObject("tcgplayer")
            val cm = pricing?.optJSONObject("cardmarket")
            TcgCard(
                id = o.optString("id"),
                name = o.optString("name"),
                localId = o.optString("localId"),
                setName = set?.optString("name") ?: "Unknown set",
                setId = set?.optString("id").orEmpty(),
                rarity = o.optString("rarity").ifBlank { null },
                image = o.optString("image").ifBlank { null },
                finishes = extractFinishes(tcg),
                cardmarketEur = cm?.optDouble("trend")?.takeIf { !it.isNaN() }
                    ?: cm?.optDouble("avg")?.takeIf { !it.isNaN() },
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun extractFinishes(tcg: JSONObject?): List<Finish> {
        if (tcg == null) return emptyList()
        val out = mutableListOf<Finish>()
        val keys = tcg.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val block = tcg.optJSONObject(key) ?: continue
            val market = block.optDouble("marketPrice").takeIf { !it.isNaN() }
            val low = block.optDouble("lowPrice").takeIf { !it.isNaN() }
            val mid = block.optDouble("midPrice").takeIf { !it.isNaN() }
            val high = block.optDouble("highPrice").takeIf { !it.isNaN() }
            if (market == null && mid == null && low == null) continue
            out += Finish(key, key.replace("-", " ").replaceFirstChar { it.uppercase() }, market, low, mid, high)
        }
        return out
    }

    private fun firstPrice(text: String): Double? {
        val lined = Regex("""(?:^|\n)\s*\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2}))\s*(?:\n|$)""")
            .find(text)?.groupValues?.get(1)
        Appraise.parseMoney(lined)?.let { if (it >= 2.5) return it }
        Regex("""\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})?)""").findAll(text).forEach {
            val v = Appraise.parseMoney(it.groupValues[1])
            if (v != null && v >= 2.5 && v < 1_000_000) return v
        }
        return null
    }

    private fun parseEbay(md: String, query: String): List<LiveListing> {
        val re = Regex("""\[([^\]]{8,220})]\(https://www\.ebay\.com/itm/(\d{12,14})[^)]*\)([\s\S]{0,700})""")
        val seen = HashSet<String>()
        val out = mutableListOf<LiveListing>()
        for (m in re.findAll(md)) {
            val id = m.groupValues[2]
            if (!seen.add(id)) continue
            val title = m.groupValues[1]
                .replace(Regex("Opens in a new window or tab", RegexOption.IGNORE_CASE), "")
                .trim()
            if (title.isBlank() || title.contains("shop on ebay", true) || Appraise.skipListing(title)) continue
            if (!Appraise.titleMatches(title, query)) continue
            val chunk = m.groupValues[3]
            val price = firstPrice(chunk) ?: continue
            val img = Regex("""(https://i\.ebayimg\.com/images/g/[^)\s]+)""").find(chunk)?.groupValues?.get(1)
            val free = Regex("Free (?:delivery|shipping)", RegexOption.IGNORE_CASE).containsMatchIn(chunk)
            out += LiveListing(id, "ebay", title, "https://www.ebay.com/itm/$id", price, if (free) 0.0 else 4.47, img)
            if (out.size >= 16) break
        }
        return out
    }

    private fun parseMercari(md: String, query: String): List<LiveListing> {
        val re = Regex("""\[([\s\S]{8,500}?)]\(https://www\.mercari\.com/us/item/(m\d+)/?[^)]*\)""")
        val seen = HashSet<String>()
        val out = mutableListOf<LiveListing>()
        for (m in re.findAll(md)) {
            val id = m.groupValues[2]
            if (!seen.add(id)) continue
            val inner = m.groupValues[1]
            val img = Regex("""(https://u-mercari-images\.mercdn\.net/[^)\s]+)""").find(inner)?.groupValues?.get(1)
            val text = inner.replace(Regex("""!\[[^\]]*]\([^)]+\)"""), " ")
            val price = firstPrice(text)
            val title = text.replace(Regex("""\$[0-9,.]+\s*"""), " ").replace(Regex("\\s+"), " ").trim()
            if (title.isBlank() || Appraise.skipListing(title) || !Appraise.titleMatches(title, query)) continue
            out += LiveListing(
                id, "mercari", title, "https://www.mercari.com/us/item/$id/",
                price, 4.49, img ?: "https://u-mercari-images.mercdn.net/photos/${id}_1.jpg",
            )
            if (out.size >= 16) break
        }
        return out
    }
}
