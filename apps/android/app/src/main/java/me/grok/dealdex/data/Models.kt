package me.grok.dealdex.data

data class DeskKeys(
    val justTcg: String = "",
    val priceCharting: String = "",
    val pokemonTcg: String = "",
) {
    fun any() = justTcg.isNotBlank() || priceCharting.isNotBlank() || pokemonTcg.isNotBlank()
}

data class Finish(
    val id: String,
    val label: String,
    val market: Double?,
    val low: Double?,
    val mid: Double?,
    val high: Double?,
)

data class TcgCard(
    val id: String,
    val name: String,
    val localId: String,
    val setName: String,
    val setId: String,
    val rarity: String?,
    val image: String?,
    val finishes: List<Finish>,
    val cardmarketEur: Double?,
)

data class LiveListing(
    val id: String,
    val marketplace: String,
    val title: String,
    val url: String,
    val price: Double?,
    val shipping: Double,
    val image: String?,
)

data class Appraisal(
    val market: Double?,
    val adjusted: Double?,
    val allIn: Double,
    val spread: Double?,
    val verdict: String,
)

data class ScoredListing(
    val listing: LiveListing,
    val card: TcgCard?,
    val appraisal: Appraisal?,
    val grade: String,
) {
    val id: String get() = listing.id
}

/** Auto-buy config for a saved filter.  Mirrors src/lib/alerts/types.ts
 *  `AutoBuyConfig`.  Cents for caps. */
data class AutoBuyConfig(
    val enabled: Boolean = false,
    val dryRun: Boolean = true,
    val maxPriceCents: Int = 5000,
    val minSpread: Double = 0.18,
    val maxMonthlyCents: Int = 50000,
    val maxDailyCents: Int = 10000,
    val coolHours: Int = 24,
    val marketplace: String = "ebay",
)

/** Out-of-app channel toggles + credentials.  Mirrors the web channels map
 *  in src/lib/alerts/types.ts.  Email / SMS / Pushover providers are gated
 *  server-side; the runner picks these up once the providers are wired. */
data class AlertChannels(
    val emailToggle: Boolean = false,
    val email: String = "",
    val smsToggle: Boolean = false,
    val phone: String = "",
    val pushoverToggle: Boolean = false,
    val pushoverUser: String = "",
    val pushoverToken: String = "",
)

data class AlertRule(
    val id: String,
    val name: String,
    val enabled: Boolean = true,
    val verdicts: List<String> = listOf("steal", "good"),
    val maxPrice: Double? = 100.0,
    val minSpread: Double? = 0.15,
    val keyword: String = "",
    val autoBuy: AutoBuyConfig = AutoBuyConfig(),
    val channels: AlertChannels = AlertChannels(),
)

data class SavedAppraisal(
    val id: String = java.util.UUID.randomUUID().toString(),
    val cardId: String,
    val cardName: String,
    val setName: String,
    val localId: String,
    val marketplace: String,
    val listingTitle: String,
    val listingPrice: Double,
    val marketPrice: Double?,
    val spread: Double?,
    val verdict: String,
    val condition: String = "NM",
    val grade: String = "raw",
    val status: String = "watching",
    val createdAt: Long = System.currentTimeMillis(),
)
