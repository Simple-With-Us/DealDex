package me.grok.dealdex.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(vm: DeskViewModel, state: DeskState) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var ebayConnected by remember { mutableStateOf(false) }
    var ebayUsername by remember { mutableStateOf<String?>(null) }
    var connectingEbay by remember { mutableStateOf(false) }
    var ebayError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.accountEmail) {
        // Refresh the OAuth status whenever the account changes.
        if (state.accountEmail.isNotBlank()) {
            ebayConnected = false
            ebayUsername = null
        }
    }

    fun connectOrDisconnectEbay() {
        if (ebayConnected) {
            // Future: server-side disconnect endpoint.
            ebayConnected = false
            ebayUsername = null
            return
        }
        connectingEbay = true
        ebayError = null
        scope.launch {
            try {
                val url = withContext(Dispatchers.IO) { EbayOAuth.start(state.origin) }
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                ctx.startActivity(intent)
            } catch (t: Throwable) {
                ebayError = t.message ?: "Could not start eBay OAuth"
            } finally {
                connectingEbay = false
            }
        }
    }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("SETTINGS", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("This Phone", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Website is https://dealdex.net by default.  Leave it unless you are on a preview host.  Sign in with Google, Apple, or X to back up keys.  Keys stay on this phone.  Scan works signed out.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )

        Spacer(Modifier.height(20.dp))
        Text("Account", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            state.origin,
            vm::setOrigin,
            label = { Text("Website") },
            placeholder = { Text("https://dealdex.net") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(Modifier.height(12.dp))
        if (state.accountEmail.isNotBlank()) {
            Text("Signed in as ${state.accountEmail}", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(8.dp))
            Button(onClick = { vm.pullKeys() }, enabled = !state.accountBusy) { Text("Pull Keys from Account") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { vm.pushKeys() }, enabled = !state.accountBusy) { Text("Push Phone Keys to Account") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { vm.signOut() }) { Text("Sign Out") }
        } else {
            Button(onClick = { vm.startOAuth(ctx, "google") }, enabled = !state.accountBusy, modifier = Modifier.fillMaxWidth()) {
                Text("Sign in with Google")
            }
            Spacer(Modifier.height(8.dp))
            Button(onClick = { vm.startOAuth(ctx, "apple") }, enabled = !state.accountBusy, modifier = Modifier.fillMaxWidth()) {
                Text("Sign in with Apple")
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { vm.startOAuth(ctx, "twitter") }, enabled = !state.accountBusy, modifier = Modifier.fillMaxWidth()) {
                Text("Sign in with X")
            }
        }
        if (state.accountNote != null) {
            Text(state.accountNote, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
        }

        Spacer(Modifier.height(24.dp))
        Text("Connected accounts", style = MaterialTheme.typography.titleMedium)
        Text(
            "Tap Connect to grant DealDex permission to place Buy It Now orders on your behalf. Sign in once with each provider — no copy-pasted keys.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
        )
        androidx.compose.foundation.layout.Row(
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        ) {
            androidx.compose.foundation.layout.Column(modifier = Modifier.weight(1f)) {
                Text("eBay", style = MaterialTheme.typography.bodyLarge)
                val sub = when {
                    ebayUsername != null -> "Connected as $ebayUsername"
                    ebayConnected -> "Connected"
                    else -> "Required for auto-buy"
                }
                Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Button(
                onClick = { connectOrDisconnectEbay() },
                enabled = !connectingEbay,
            ) {
                Text(when {
                    connectingEbay -> "Opening…"
                    ebayConnected -> "Disconnect"
                    else -> "Connect eBay"
                })
            }
        }
        if (ebayError != null) {
            Text(ebayError!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp))
        }

        Spacer(Modifier.height(24.dp))
        Text("API Desks", style = MaterialTheme.typography.titleMedium)
        Text(
            "Paid desks stay off until you paste a key. DealDex talks to them from this phone.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
        )
        OutlinedTextField(state.justTcg, vm::setJustTcg, label = { Text("JustTCG Key") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(state.priceCharting, vm::setPriceCharting, label = { Text("PriceCharting Token") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(state.pokemonTcg, vm::setPokemonTcg, label = { Text("Pokémon TCG API Key") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Spacer(Modifier.height(16.dp))
        Button(onClick = { vm.saveKeys() }) { Text("Save on This Phone") }
        if (state.settingsNote != null) {
            Text(state.settingsNote, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

/**
 * Thin wrapper around `/api/settings/ebay/oauth/start` so the Android
 * Settings screen can hand the user off to a system-browser OAuth consent
 * flow.  The redirect lands on the same dealdex.net callback, which the
 * user reaches once they have a browser tab open.  When the user comes
 * back to the app, `account?ebay=connected` flips the row to Connected.
 */
object EbayOAuth {
    fun start(origin: String): String {
        val base = origin.trim().trimEnd('/').ifBlank { "https://dealdex.net" }
        val url = URL("$base/api/settings/ebay/oauth/start")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = false
        }
        val code = conn.responseCode
        if (code !in 200..299) {
            error("eBay OAuth start failed: HTTP $code")
        }
        val body = conn.inputStream.bufferedReader().use { it.readText() }
        return JSONObject(body).getString("url")
    }
}
