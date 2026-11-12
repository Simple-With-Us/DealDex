package me.grok.dealdex.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import me.grok.dealdex.data.SavedAppraisal

@Composable
fun SavedScreen(vm: DeskViewModel, state: DeskState) {
    var filter by remember { mutableStateOf("all") }
    val filtered = if (filter == "all") state.savedItems else state.savedItems.filter { it.status == filter }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
    ) {
        Text("DEAL LEDGER", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Saved Appraisals", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = filter == "all", onClick = { filter = "all" }, label = { Text("All (${state.savedItems.size})") })
            FilterChip(selected = filter == "watching", onClick = { filter = "watching" }, label = { Text("Watching") })
            FilterChip(selected = filter == "bought", onClick = { filter = "bought" }, label = { Text("Bought") })
            FilterChip(selected = filter == "passed", onClick = { filter = "passed" }, label = { Text("Passed") })
        }

        Spacer(Modifier.height(12.dp))

        if (filtered.isEmpty()) {
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("No saved appraisals yet.", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Appraise a card or tap save on any scan result to build your portfolio deal ledger.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(filtered, key = { it.id }) { item ->
                    SavedCardItem(item, onDelete = { vm.deleteSaved(item.id) }, onStatusChange = { s -> vm.updateSavedStatus(item.id, s) })
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavedCardItem(
    item: SavedAppraisal,
    onDelete: () -> Unit,
    onStatusChange: (String) -> Unit,
) {
    val verdictColor = when (item.verdict) {
        "steal", "good" -> DealGood
        "high", "avoid" -> DealBad
        else -> DealFair
    }
    var menuExpanded by remember { mutableStateOf(false) }

    Surface(shape = RoundedCornerShape(12.dp), tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(item.cardName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(item.verdict.uppercase(), color = verdictColor, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
            Text("${item.setName} #${item.localId} · ${item.condition}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

            Spacer(Modifier.height(6.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Ask: $%.2f".format(item.listingPrice), fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                item.marketPrice?.let {
                    Text("Book: $%.2f".format(it), fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                item.spread?.let {
                    Text("%+.1f%%".format(it * 100), color = verdictColor, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(8.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                ExposedDropdownMenuBox(
                    expanded = menuExpanded,
                    onExpandedChange = { menuExpanded = !menuExpanded },
                ) {
                    OutlinedTextField(
                        value = item.status.replaceFirstChar { it.uppercase() },
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = menuExpanded) },
                        modifier = Modifier.menuAnchor(),
                        textStyle = MaterialTheme.typography.labelSmall,
                    )
                    ExposedDropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                    ) {
                        listOf("watching", "bought", "passed").forEach { st ->
                            DropdownMenuItem(
                                text = { Text(st.replaceFirstChar { it.uppercase() }) },
                                onClick = {
                                    onStatusChange(st)
                                    menuExpanded = false
                                },
                            )
                        }
                    }
                }

                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
