package me.grok.dealdex.ui

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import me.grok.dealdex.R
import me.grok.dealdex.data.AccountApi
import me.grok.dealdex.data.AlertRule
import me.grok.dealdex.data.DeskKeys
import me.grok.dealdex.data.Market
import me.grok.dealdex.data.NativeAuth
import me.grok.dealdex.data.Prefs
import me.grok.dealdex.data.SavedAppraisal
import me.grok.dealdex.data.ScoredListing
import me.grok.dealdex.data.TcgCard
import org.json.JSONArray
import org.json.JSONObject

data class DeskState(
    val query: String = "",
    val loading: Boolean = false,
    val rows: List<ScoredListing> = emptyList(),
    val error: String? = null,
    val view: String = "all",
    val sources: Set<String> = setOf("ebay", "mercari"),
    val rules: List<AlertRule> = listOf(AlertRule("default", "Steals under $100")),
    val savedItems: List<SavedAppraisal> = emptyList(),
    val currentTab: String = "scan",
    val activeDossierCard: TcgCard? = null,
    val evaluatorCard: TcgCard? = null,
    val justTcg: String = "",
    val priceCharting: String = "",
    val pokemonTcg: String = "",
    val settingsNote: String? = null,
    val origin: String = "",
    val loginEmail: String = "",
    val loginPassword: String = "",
    val accountEmail: String = "",
    val accountBusy: Boolean = false,
    val accountNote: String? = null,
    val hideProxies: Boolean = true,
    val verdictFilter: String = "any",
    val priceCap: String = "any",
    val condition: String = "any",
    val spreadMin: String = "any",
    val finish: String = "any",
)

class DeskViewModel(app: Application) : AndroidViewModel(app) {
    private val prefs = Prefs(app)
    private val _state = MutableStateFlow(DeskState())
    val state: StateFlow<DeskState> = _state

    init {
        val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel("deals", "Deal alerts", NotificationManager.IMPORTANCE_DEFAULT),
        )
        _state.value = _state.value.copy(
            justTcg = prefs.justTcg,
            priceCharting = prefs.priceCharting,
            pokemonTcg = prefs.pokemonTcg,
            origin = prefs.origin.ifBlank { "https://dealdex.net" },
            loginEmail = prefs.email,
            accountEmail = if (prefs.signedIn()) prefs.email else "",
        )
        scan("")
    }

    private fun keys() = DeskKeys(
        justTcg = _state.value.justTcg,
        priceCharting = _state.value.priceCharting,
        pokemonTcg = _state.value.pokemonTcg,
    )

    fun setQuery(q: String) { _state.value = _state.value.copy(query = q) }
    fun setView(v: String) { _state.value = _state.value.copy(view = v) }
    fun setHideProxies(v: Boolean) { _state.value = _state.value.copy(hideProxies = v) }
    fun setVerdictFilter(v: String) { _state.value = _state.value.copy(verdictFilter = v) }
    fun setPriceCap(v: String) { _state.value = _state.value.copy(priceCap = v) }
    fun setCondition(v: String) { _state.value = _state.value.copy(condition = v) }
    fun setSpreadMin(v: String) { _state.value = _state.value.copy(spreadMin = v) }
    fun setFinish(v: String) { _state.value = _state.value.copy(finish = v) }
    fun toggleSource(market: String) {
        val current = _state.value.sources
        val next = if (market in current) {
            if (current.size <= 1) current else current - market
        } else {
            current + market
        }
        _state.value = _state.value.copy(sources = next)
        scan()
    }
    fun setJustTcg(v: String) { _state.value = _state.value.copy(justTcg = v, settingsNote = null) }
    fun setPriceCharting(v: String) { _state.value = _state.value.copy(priceCharting = v, settingsNote = null) }
    fun setPokemonTcg(v: String) { _state.value = _state.value.copy(pokemonTcg = v, settingsNote = null) }
    fun setOrigin(v: String) { _state.value = _state.value.copy(origin = v) }
    fun setLoginEmail(v: String) { _state.value = _state.value.copy(loginEmail = v) }
    fun setLoginPassword(v: String) { _state.value = _state.value.copy(loginPassword = v) }

    fun setTab(tab: String) {
        _state.value = _state.value.copy(currentTab = tab)
    }

    fun openDossier(card: me.grok.dealdex.data.TcgCard) {
        _state.value = _state.value.copy(activeDossierCard = card, currentTab = "dossier")
    }

    fun openEvaluator(card: me.grok.dealdex.data.TcgCard? = null) {
        _state.value = _state.value.copy(evaluatorCard = card, currentTab = "evaluator")
    }

    fun saveAppraisal(item: SavedAppraisal) {
        val current = _state.value.savedItems
        val next = listOf(item) + current.filterNot { it.id == item.id }
        _state.value = _state.value.copy(savedItems = next)
    }

    fun deleteSaved(id: String) {
        val next = _state.value.savedItems.filterNot { it.id == id }
        _state.value = _state.value.copy(savedItems = next)
    }

    fun updateSavedStatus(id: String, status: String) {
        val next = _state.value.savedItems.map { if (it.id == id) it.copy(status = status) else it }
        _state.value = _state.value.copy(savedItems = next)
    }

    fun saveKeys() {
        prefs.justTcg = _state.value.justTcg
        prefs.priceCharting = _state.value.priceCharting
        prefs.pokemonTcg = _state.value.pokemonTcg
        _state.value = _state.value.copy(settingsNote = "Saved on this phone.  Scan uses them even if dealdex.net is down.")
    }

    fun scan(q: String = _state.value.query) {
        _state.value = _state.value.copy(loading = true, error = null, query = q)
        val desk = keys()
        val sources = _state.value.sources
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val origin = _state.value.origin.ifBlank { "https://dealdex.net" }
                val rows = Market.scan(q, desk, sources, origin)
                _state.value = _state.value.copy(loading = false, rows = rows)
                fireAlerts(rows)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "Scan failed")
            }
        }
    }

    fun saveRule(rule: AlertRule) {
        val next = _state.value.rules.filterNot { it.id == rule.id } + rule
        _state.value = _state.value.copy(rules = next)
    }

    fun startOAuth(ctx: Context, provider: String) {
        val origin = _state.value.origin.ifBlank { NativeAuth.DEFAULT_ORIGIN }
        NativeAuth.start(ctx, prefs, origin, provider)
    }

    /**
     * Finish sign-in. The redirect now carries a single-use CODE rather than the
     * session token, so completing it means an HTTPS round trip — this cannot
     * run on the main thread any more.
     */
    fun completeOAuth(uri: Uri) {
        _state.value = _state.value.copy(accountBusy = true, accountNote = null)
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val origin = NativeAuth.normalized(_state.value.origin)
                val session = NativeAuth.complete(prefs, uri, origin)
                prefs.origin = origin
                prefs.token = session.token
                prefs.email = session.email
                _state.value = _state.value.copy(
                    accountBusy = false,
                    accountEmail = session.email.ifBlank { "Signed in" },
                    origin = origin,
                    accountNote = "Signed in. Keys still live on this phone. Pull or push to sync.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    accountBusy = false,
                    accountNote = (e.message ?: "Sign-in failed") + " Scan still works with saved keys.",
                )
            }
        }
    }

    fun pullKeys() {
        val origin = prefs.origin
        val token = prefs.token
        if (origin.isBlank() || token.isBlank()) {
            _state.value = _state.value.copy(accountNote = "Sign in first.")
            return
        }
        _state.value = _state.value.copy(accountBusy = true, accountNote = null)
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val remote = AccountApi.pullKeys(origin, token)
                if (remote.justTcg.isNotBlank()) prefs.justTcg = remote.justTcg
                if (remote.priceCharting.isNotBlank()) prefs.priceCharting = remote.priceCharting
                if (remote.pokemonTcg.isNotBlank()) prefs.pokemonTcg = remote.pokemonTcg
                _state.value = _state.value.copy(
                    accountBusy = false,
                    justTcg = prefs.justTcg,
                    priceCharting = prefs.priceCharting,
                    pokemonTcg = prefs.pokemonTcg,
                    accountNote = "Pulled into this phone. Scan will use them even if the site goes down.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    accountBusy = false,
                    accountNote = (e.message ?: "Website unreachable") + " — using the keys already on this phone.",
                )
            }
        }
    }

    fun pushKeys() {
        val origin = prefs.origin
        val token = prefs.token
        if (origin.isBlank() || token.isBlank()) {
            _state.value = _state.value.copy(accountNote = "Sign in first.")
            return
        }
        prefs.justTcg = _state.value.justTcg
        prefs.priceCharting = _state.value.priceCharting
        prefs.pokemonTcg = _state.value.pokemonTcg
        _state.value = _state.value.copy(accountBusy = true, accountNote = null)
        viewModelScope.launch(Dispatchers.IO) {
            try {
                AccountApi.pushKeys(origin, token, keys())
                _state.value = _state.value.copy(accountBusy = false, accountNote = "Phone keys copied to your account.")
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    accountBusy = false,
                    accountNote = (e.message ?: "Website unreachable") + " — keys stay on this phone.",
                )
            }
        }
    }

    fun signOut() {
        prefs.token = ""
        _state.value = _state.value.copy(accountEmail = "", accountNote = "Signed out. Saved keys stay on this phone.")
    }

    private fun fireAlerts(rows: List<ScoredListing>) {
        val ctx = getApplication<Application>()
        var i = 1
        for (rule in _state.value.rules.filter { it.enabled }) {
            for (row in rows) {
                val a = row.appraisal ?: continue
                if (rule.verdicts.isNotEmpty() && a.verdict !in rule.verdicts) continue
                if (rule.maxPrice != null && (row.listing.price ?: Double.MAX_VALUE) > rule.maxPrice) continue
                if (rule.minSpread != null && (a.spread ?: -1.0) < rule.minSpread) continue
                if (rule.keyword.isNotBlank() && !row.listing.title.contains(rule.keyword, true)) continue
                val n = NotificationCompat.Builder(ctx, "deals")
                    .setSmallIcon(R.drawable.ic_delta)
                    .setContentTitle(rule.name)
                    .setContentText("${row.listing.title} · $${row.listing.price}")
                    .setAutoCancel(true)
                    .build()
                try {
                    NotificationManagerCompat.from(ctx).notify(i++, n)
                } catch (_: SecurityException) {
                }
            }
        }
    }

    fun visible(): List<ScoredListing> {
        val s = _state.value
        return s.rows.filter { row ->
            if (s.hideProxies) {
                val t = row.listing.title.lowercase()
                if ("proxy" in t || "repack" in t || "replica" in t) return@filter false
            }
            when (s.view) {
                "ebay" -> if (row.listing.marketplace != "ebay") return@filter false
                "mercari" -> if (row.listing.marketplace != "mercari") return@filter false
                "deals" -> {
                    val v = row.appraisal?.verdict
                    if (v != "steal" && v != "good") return@filter false
                }
                "verified" -> {
                    val v = row.appraisal?.verdict
                    if (row.card == null || (v != "steal" && v != "good")) return@filter false
                }
                else -> {}
            }
            if (s.verdictFilter != "any" && row.appraisal?.verdict != s.verdictFilter) return@filter false
            if (s.priceCap != "any") {
                val cap = s.priceCap.toDoubleOrNull() ?: return@filter false
                val price = row.listing.price ?: return@filter false
                if (price > cap) return@filter false
            }
            if (s.condition == "raw" && row.grade != "raw") return@filter false
            if (s.condition == "graded" && row.grade == "raw") return@filter false
            if (s.spreadMin != "any") {
                val min = s.spreadMin.toDoubleOrNull() ?: return@filter false
                val spread = row.appraisal?.spread ?: return@filter false
                if (spread < min / 100) return@filter false
            }
            if (s.finish != "any") {
                val blob = row.listing.title.lowercase()
                if (s.finish !in blob) return@filter false
            }
            true
        }
    }
}
