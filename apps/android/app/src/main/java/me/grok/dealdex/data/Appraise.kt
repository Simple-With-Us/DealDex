package me.grok.dealdex.data

object Appraise {
    private val skip = Regex(
        """\b(lots?\b|\d+\s+cards\b|bulk|binder|choose your|pick your|etb|booster|code card|proxy|custom\b|plush|hoodie|t-?shirt)\b""",
        RegexOption.IGNORE_CASE,
    )

    fun skipListing(title: String) = skip.containsMatchIn(title)

    fun parseMoney(raw: String?): Double? {
        if (raw.isNullOrBlank()) return null
        val n = raw.replace(",", "").toDoubleOrNull() ?: return null
        return if (n > 0) n else null
    }

    fun significantTokens(query: String): List<String> {
        val generic = setOf("pokemon", "pokémon", "tcg", "card", "cards", "holo", "rare")
        return query.lowercase().replace(Regex("[^a-z0-9\\s]"), " ")
            .split(Regex("\\s+")).filter { it.length > 2 && it !in generic }
    }

    fun titleMatches(title: String, query: String): Boolean {
        val t = significantTokens(query).firstOrNull() ?: return true
        return title.lowercase().contains(t)
    }

    /**
     * Kept in step with `detectGrade` in `src/lib/tcg/parse-listing.ts` so the
     * phone and the website reach the same verdict on the same listing.  PSA 8,
     * BGS 9.5, CGC 9.5 and ACE 10 used to fall through to "raw".
     */
    fun detectGrade(text: String): String {
        val t = text.uppercase().replace(Regex("\\s+"), " ")
        val checks = listOf(
            Regex("\\bPSA ?10\\b") to "PSA 10",
            Regex("\\bPSA ?9\\b") to "PSA 9",
            Regex("\\bPSA ?8\\b") to "PSA 8",
            Regex("\\bBGS ?10\\b") to "BGS 10",
            Regex("\\bBGS ?9\\.5\\b") to "BGS 9.5",
            Regex("\\bCGC ?10\\b") to "CGC 10",
            Regex("\\bCGC ?9\\.5\\b") to "CGC 9.5",
            Regex("\\bACE ?10\\b") to "ACE 10",
        )
        for ((re, grade) in checks) if (re.containsMatchIn(t)) return grade
        return "raw"
    }

    /**
     * A standalone `HP` in a Pokemon listing title is the hit-point stat, not
     * Heavily Played.  `"hp" in t` matched a large share of every scan and cut
     * the book to 35%, so the app called real deals overpriced.  `"lp" in t`
     * matched "Delphox"; `"mp" in t` matched "champion"; `"played" in t` even
     * matched "lightly played" before the LP branch could see it.
     */
    /**
     * `HP` is the only condition code that collides with card text — it is also
     * the hit-point stat.  `LP`, `MP` and `DMG` never are, so the digit guard
     * applies to `hp` alone.  Applying it to all four swallowed the code in
     * `Charizard Base Set 4/102 LP`, which came back Near Mint.
     */
    private val digitAmbiguous = setOf("hp")

    fun hasConditionCode(text: String, code: String): Boolean {
        // Bracketed, slash-joined or explicitly labelled: never a stat line.
        if (Regex("([(\\[/]|\\bcond(ition)?\\b[ :-]*)\\s*$code\\b", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
            return true
        }
        val re = Regex("(^|[^a-z0-9])$code([^a-z0-9]|$)", RegexOption.IGNORE_CASE)
        val guardDigits = code in digitAmbiguous
        for (m in re.findAll(text)) {
            if (guardDigits) {
                val before = text.substring(0, m.range.first + m.groupValues[1].length)
                val after = text.substring(minOf(m.range.last + 1, text.length))
                if (Regex("\\d\\s*\\W?\\s*$").containsMatchIn(before)) continue
                if (Regex("^\\W?\\s*\\d").containsMatchIn(after)) continue
            }
            return true
        }
        return false
    }

    fun detectCondition(text: String): Double {
        val t = text.lowercase()
        // Spelled out is unambiguous and wins — but word-bound it.  A bare
        // `"damaged" in t` also matches "UNDAMAGED", which is a common seller
        // word and would have applied the 0.2x haircut to a clean card.
        fun has(pattern: String) = Regex("\\b$pattern\\b").containsMatchIn(t)
        if (has("damaged") || has("poor condition")) return 0.2
        if (has("heavily played") || has("heavy play")) return 0.35
        if (has("moderately played") || has("moderate play")) return 0.55
        if (has("lightly played") || has("light play")) return 0.8
        if (has("near mint") || has("mint condition")) return 1.0

        if (hasConditionCode(t, "dmg")) return 0.2
        if (hasConditionCode(t, "hp")) return 0.35
        if (hasConditionCode(t, "mp")) return 0.55
        if (hasConditionCode(t, "lp")) return 0.8
        return 1.0
    }

    /** Mirrors `GRADE_MULT` / `PSA10_BY_BUCKET` in `src/lib/tcg/appraise.ts`. */
    private val gradeMultBase = mapOf(
        "PSA 10" to 2.8, "PSA 9" to 1.35, "PSA 8" to 0.95,
        "BGS 10" to 3.2, "BGS 9.5" to 1.8,
        "CGC 10" to 2.4, "CGC 9.5" to 1.4,
        "ACE 10" to 2.2,
    )

    fun gradeMult(card: TcgCard?, grade: String): Double {
        if (grade == "raw") return 1.0
        val base = gradeMultBase[grade] ?: 1.0
        // The bucket scales this card's WHOLE grade curve, anchored on PSA 10.
        // Scaling only the 10s inverted the ordering on modern cards: PSA 10
        // came back 1.25 while PSA 9 kept its flat 1.35.
        if (card == null) return base
        val set = "${card.setId} ${card.setName}".lowercase()
        val rarity = card.rarity.orEmpty().lowercase()
        // Same vintage set list as the web: base2/base3/base4/gym/team rocket
        // were missing here, so those sets graded as modern.
        val vintage = Regex("base1|base2|base3|base4|jungle|fossil|neo|gym|team rocket|wotc")
            .containsMatchIn(set)
        val chase = Regex("illustration rare|special illustration|alt art|hyper rare|secret")
            .containsMatchIn(rarity)
        val bucket = when {
            vintage && rarity.contains("holo") -> 8.0
            vintage -> 4.0
            chase -> 2.1
            else -> 1.25
        }
        return base * (bucket / 2.8)
    }

    fun pickMarket(card: TcgCard): Double? =
        card.finishes.firstOrNull { it.market != null }?.market

    fun appraise(card: TcgCard, listing: LiveListing, grade: String, extra: Double? = null): Appraisal {
        val seed = listOfNotNull(pickMarket(card), extra)
        val raw = if (seed.isEmpty()) null else seed.average()
        val adjusted = raw?.let { it * detectCondition(listing.title) * gradeMult(card, grade) }
        val allIn = (listing.price ?: 0.0) + listing.shipping
        val spread = if (adjusted != null && adjusted > 0) (adjusted - allIn) / adjusted else null
        val verdict = when {
            spread == null -> "fair"
            spread >= 0.30 -> "steal"
            spread >= 0.12 -> "good"
            spread >= -0.08 -> "fair"
            spread >= -0.30 -> "high"
            else -> "avoid"
        }
        return Appraisal(raw, adjusted, allIn, spread, verdict)
    }

    fun nameQuery(title: String): String {
        val stop = setOf(
            "pokemon", "pokémon", "tcg", "card", "cards", "holo", "rare", "nm", "lp",
            "psa", "bgs", "cgc", "english", "japanese", "raw", "mint",
        )
        val tokens = title.lowercase().replace(Regex("https?://\\S+"), " ")
            .replace(Regex("\\$[0-9,.]+"), " ")
            .replace(Regex("[^a-z0-9'\\s-]"), " ")
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() && it !in stop && !it.all(Char::isDigit) }
        return tokens.take(4).joinToString(" ").ifBlank { "pokemon" }
    }
}
