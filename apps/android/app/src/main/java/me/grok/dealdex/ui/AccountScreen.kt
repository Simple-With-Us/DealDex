package me.grok.dealdex.ui

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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

@Composable
fun AccountScreen(vm: DeskViewModel, state: DeskState) {
    val ctx = LocalContext.current
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("ACCOUNT", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Sign in to sync keys", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Leave Website as https://dealdex.net.  Scan already uses that host if the field is empty.  Change it only for a preview URL.  Sign-in and key sync talk to this address.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
        Spacer(Modifier.height(16.dp))
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
            Button(onClick = { vm.pullKeys() }, enabled = !state.accountBusy) { Text("Pull keys from account") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { vm.pushKeys() }, enabled = !state.accountBusy) { Text("Push phone keys to account") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { vm.signOut() }) { Text("Sign out") }
        } else {
            Button(
                onClick = { vm.startOAuth(ctx, "google") },
                enabled = !state.accountBusy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Sign in with Google") }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { vm.startOAuth(ctx, "apple") },
                enabled = !state.accountBusy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Sign in with Apple") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = { vm.startOAuth(ctx, "twitter") },
                enabled = !state.accountBusy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Sign in with X") }
        }
        if (state.accountNote != null) {
            Text(state.accountNote, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 12.dp))
        }
    }
}
