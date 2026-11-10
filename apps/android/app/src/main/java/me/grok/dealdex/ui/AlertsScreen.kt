package me.grok.dealdex.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import me.grok.dealdex.MainActivity
import me.grok.dealdex.data.AlertRule
import me.grok.dealdex.data.AutoBuyConfig

@Composable
fun AlertsScreen(vm: DeskViewModel, state: DeskState) {
    val rule = state.rules.firstOrNull() ?: AlertRule("default", "Steals under \$100")
    val activity = LocalContext.current as? MainActivity

    // Ask on arrival, not at cold start and not only on the switch's rising
    // edge.  The default rule ships enabled, so the switch renders already ON
    // and `onCheckedChange` never fires on a fresh install — POST_NOTIFICATIONS
    // was therefore never requested and every alert was silently dropped on
    // Android 13+.  Opening this screen is the in-context moment.
    LaunchedEffect(rule.enabled) {
        if (rule.enabled) activity?.requestNotificationPermission()
    }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("ALERTS", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Native deal pings", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(rule.name, { vm.saveRule(rule.copy(name = it)) }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(rule.keyword, { vm.saveRule(rule.copy(keyword = it)) }, label = { Text("Keyword (blank = all Pokémon)") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            (rule.maxPrice ?: 0.0).let { if (it == 0.0) "" else it.toInt().toString() },
            { vm.saveRule(rule.copy(maxPrice = it.toDoubleOrNull())) },
            label = { Text("Max ask") },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            rule.minSpread?.let { (it * 100).toInt().toString() } ?: "",
            { vm.saveRule(rule.copy(minSpread = it.toDoubleOrNull()?.div(100.0))) },
            label = { Text("Min spread %") },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        Switch(
            checked = rule.enabled,
            onCheckedChange = { on ->
                vm.saveRule(rule.copy(enabled = on))
                // Ask for notification permission HERE, when the user has just
                // said they want alerts — not at cold start before they have
                // seen a single listing.
                if (on) activity?.requestNotificationPermission()
            },
        )
        Text(if (rule.enabled) "Alerts on" else "Alerts off", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(16.dp))
        Text("Out-of-app channels", style = MaterialTheme.typography.titleSmall)
        val channels = rule.channels
        ChannelRow(label = "Email me", checked = channels.emailToggle) { on ->
            vm.saveRule(rule.copy(channels = channels.copy(emailToggle = on)))
        }
        if (channels.emailToggle) {
            OutlinedTextField(
                channels.email,
                { vm.saveRule(rule.copy(channels = channels.copy(email = it))) },
                label = { Text("Email address") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        ChannelRow(label = "SMS me", checked = channels.smsToggle) { on ->
            vm.saveRule(rule.copy(channels = channels.copy(smsToggle = on)))
        }
        if (channels.smsToggle) {
            OutlinedTextField(
                channels.phone,
                { vm.saveRule(rule.copy(channels = channels.copy(phone = it))) },
                label = { Text("Mobile number (E.164)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        ChannelRow(label = "Pushover", checked = channels.pushoverToggle) { on ->
            vm.saveRule(rule.copy(channels = channels.copy(pushoverToggle = on)))
        }
        if (channels.pushoverToggle) {
            OutlinedTextField(
                channels.pushoverUser,
                { vm.saveRule(rule.copy(channels = channels.copy(pushoverUser = it))) },
                label = { Text("Pushover user key") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                channels.pushoverToken,
                { vm.saveRule(rule.copy(channels = channels.copy(pushoverToken = it))) },
                label = { Text("Pushover API token") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        Text(
            "Out-of-app channels are gated by server-side providers; the alert config is saved locally today and the runner will pick it up once the providers are wired (server-side PR #7).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        Text("Auto-buy (dry-run by default)", style = MaterialTheme.typography.titleSmall)
        ChannelRow(label = "Buy It Now within caps", checked = rule.autoBuy.enabled) { on ->
            vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(enabled = on)))
        }
        if (rule.autoBuy.enabled) {
            OutlinedTextField(
                rule.autoBuy.maxPriceCents.toString(),
                { v ->
                    vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(maxPriceCents = (v.toIntOrNull() ?: 0).coerceAtLeast(0))))
                },
                label = { Text("Max all-in (cents)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                rule.autoBuy.minSpread.toString(),
                { v ->
                    vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(minSpread = (v.toDoubleOrNull() ?: 0.0).coerceIn(0.0, 1.0))))
                },
                label = { Text("Min spread (0..1)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                rule.autoBuy.maxDailyCents.toString(),
                { v ->
                    vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(maxDailyCents = (v.toIntOrNull() ?: 0).coerceAtLeast(0))))
                },
                label = { Text("Max daily (cents)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                rule.autoBuy.maxMonthlyCents.toString(),
                { v ->
                    vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(maxMonthlyCents = (v.toIntOrNull() ?: 0).coerceAtLeast(0))))
                },
                label = { Text("Max monthly (cents)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                rule.autoBuy.coolHours.toString(),
                { v ->
                    vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(coolHours = (v.toIntOrNull() ?: 0).coerceAtLeast(0))))
                },
                label = { Text("Cooldown (hours)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            ChannelRow(label = "Dry-run (recommended)", checked = rule.autoBuy.dryRun) { on ->
                vm.saveRule(rule.copy(autoBuy = rule.autoBuy.copy(dryRun = on)))
            }
        }
        Spacer(Modifier.height(16.dp))
        Button(onClick = { vm.scan() }) { Text("Scan now and notify") }
        Text(
            "Matches fire after each scan on this phone.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 12.dp),
        )
    }
}

@Composable
private fun ChannelRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    androidx.compose.foundation.layout.Row(
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
    ) {
        Switch(checked = checked, onCheckedChange = onCheckedChange)
        Spacer(Modifier.padding(horizontal = 8.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}
