package me.grok.dealdex.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.grok.dealdex.data.Appraise
import me.grok.dealdex.data.Market
import me.grok.dealdex.data.SavedAppraisal
import me.grok.dealdex.data.TcgCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EvaluatorScreen(
    vm: DeskViewModel,
    initialCard: TcgCard? = null,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf(initialCard?.name ?: "") }
    var searching by remember { mutableStateOf(false) }
    var searchResults by remember { mutableStateOf<List<TcgCard>>(emptyList()) }
    var activeCard by remember { mutableStateOf<TcgCard?>(initialCard) }
    var askPrice by remember { mutableStateOf("") }
    var shipping by remember { mutableStateOf("4.50") }
    var condition by remember { mutableStateOf("NM") }
    var grade by remember { mutableStateOf("raw") }
    var isSaved by remember { mutableStateOf(false) }

    val conditions = listOf("NM", "LP", "MP", "HP", "DMG")
    val grades = listOf("raw", "PSA 10", "PSA 9", "PSA 8", "BGS 10", "CGC 10", "ACE 10")

    var condExpanded by remember { mutableStateOf(false) }
    var gradeExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(initialCard) {
        if (initialCard != null) {
            activeCard = initialCard
            query = initialCard.name
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("POKÉMON EVALUATOR", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Appraise a Listing", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        Surface(shape = RoundedCornerShape(12.dp), tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("CARD SEARCH", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("e.g. Charizard 151") },
                    )
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (query.isNotBlank()) {
                                searching = true
                                scope.launch(Dispatchers.IO) {
                                    val cards = Market.searchCards(query.trim())
                                    withContext(Dispatchers.Main) {
                                        searchResults = cards
                                        searching = false
                                        if (cards.isNotEmpty()) activeCard = cards.first()
                                    }
                                }
                            }
                        },
                        enabled = !searching,
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null)
                    }
                }
            }
        }

        if (searching) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator()
                Text(" Searching cards…", modifier = Modifier.padding(start = 8.dp))
            }
        }

        activeCard?.let { card ->
            Surface(shape = RoundedCornerShape(12.dp), tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(card.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("${card.setName} #${card.localId}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

                    Spacer(Modifier.height(16.dp))

                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = askPrice,
                            onValueChange = { askPrice = it },
                            label = { Text("Ask Price ($)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = shipping,
                            onValueChange = { shipping = it },
                            label = { Text("Shipping ($)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        ExposedDropdownMenuBox(
                            expanded = condExpanded,
                            onExpandedChange = { condExpanded = !condExpanded },
                            modifier = Modifier.weight(1f),
                        ) {
                            OutlinedTextField(
                                value = condition,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Condition") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = condExpanded) },
                                modifier = Modifier.menuAnchor(),
                            )
                            ExposedDropdownMenu(
                                expanded = condExpanded,
                                onDismissRequest = { condExpanded = false },
                            ) {
                                conditions.forEach { c ->
                                    DropdownMenuItem(
                                        text = { Text(c) },
                                        onClick = {
                                            condition = c
                                            condExpanded = false
                                        },
                                    )
                                }
                            }
                        }

                        ExposedDropdownMenuBox(
                            expanded = gradeExpanded,
                            onExpandedChange = { gradeExpanded = !gradeExpanded },
                            modifier = Modifier.weight(1f),
                        ) {
                            OutlinedTextField(
                                value = grade,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Grade") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = gradeExpanded) },
                                modifier = Modifier.menuAnchor(),
                            )
                            ExposedDropdownMenu(
                                expanded = gradeExpanded,
                                onDismissRequest = { gradeExpanded = false },
                            ) {
                                grades.forEach { g ->
                                    DropdownMenuItem(
                                        text = { Text(g) },
                                        onClick = {
                                            grade = g
                                            gradeExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }

                    val ask = askPrice.toDoubleOrNull()
                    if (ask != null) {
                        val ship = shipping.toDoubleOrNull() ?: 0.0
                        val allIn = ask + ship
                        val rawMarket = Appraise.pickMarket(card) ?: 0.0
                        val mult = when (condition) {
                            "NM" -> 1.0
                            "LP" -> 0.8
                            "MP" -> 0.55
                            "HP" -> 0.35
                            "DMG" -> 0.2
                            else -> 1.0
                        } * when (grade) {
                            "PSA 10" -> 2.8
                            "PSA 9" -> 1.35
                            "PSA 8" -> 0.95
                            "BGS 10" -> 3.2
                            "CGC 10" -> 2.4
                            "ACE 10" -> 2.2
                            else -> 1.0
                        }
                        val book = rawMarket * mult
                        val dollarsOff = book - allIn
                        val spread = if (book > 0) dollarsOff / book else 0.0
                        val verdict = when {
                            spread >= 0.30 -> "steal"
                            spread >= 0.12 -> "good"
                            spread >= -0.08 -> "fair"
                            spread >= -0.30 -> "high"
                            else -> "avoid"
                        }
                        val verdictColor = when (verdict) {
                            "steal", "good" -> DealGood
                            "high", "avoid" -> DealBad
                            else -> DealFair
                        }
                        val flipNet = (book * (1.0 - 0.1125)) - allIn

                        Spacer(Modifier.height(16.dp))

                        ElevatedCard(
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("APPRAISAL VERDICT", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(verdict.uppercase(), color = verdictColor, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                }

                                Spacer(Modifier.height(8.dp))

                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Column {
                                        Text("All-in Ask", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text("$%.2f".format(allIn), style = MaterialTheme.typography.titleMedium, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                    }
                                    Column {
                                        Text("Book Middle", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text("$%.2f".format(book), style = MaterialTheme.typography.titleMedium, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                    }
                                    Column {
                                        Text("Spread", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text("%+.1f%%".format(spread * 100), color = verdictColor, style = MaterialTheme.typography.titleMedium, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                    }
                                }

                                Spacer(Modifier.height(10.dp))

                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Net Flip (after ~11.2% fees):", style = MaterialTheme.typography.bodySmall)
                                    Text("%+$%.2f".format(flipNet), color = if (flipNet > 0) DealGood else MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                }

                                if (grade == "raw" && condition == "NM" && rawMarket > 0) {
                                    val psa10Value = rawMarket * 2.8
                                    val psa10Net = (psa10Value * (1.0 - 0.1125)) - (allIn + 22.0)
                                    if (psa10Net > 20) {
                                        Spacer(Modifier.height(8.dp))
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = MaterialTheme.colorScheme.primaryContainer,
                                            modifier = Modifier.fillMaxWidth(),
                                        ) {
                                            Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                                Icon(Icons.Default.Star, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                                Column(Modifier.padding(start = 8.dp)) {
                                                    Text("PSA 10 Slab Upside: Est. $${psa10Value.toInt()}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                                    Text("Net after $22 grading: +$%.2f".format(psa10Net), style = MaterialTheme.typography.bodySmall)
                                                }
                                            }
                                        }
                                    }
                                }

                                Spacer(Modifier.height(12.dp))

                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = {
                                            val item = SavedAppraisal(
                                                cardId = card.id,
                                                cardName = card.name,
                                                setName = card.setName,
                                                localId = card.localId,
                                                marketplace = "custom",
                                                listingTitle = "${card.name} ${card.setName}",
                                                listingPrice = ask,
                                                marketPrice = book,
                                                spread = spread,
                                                verdict = verdict,
                                                condition = condition,
                                                grade = grade,
                                            )
                                            vm.saveAppraisal(item)
                                            isSaved = true
                                            Toast.makeText(ctx, "Saved to Ledger", Toast.LENGTH_SHORT).show()
                                        },
                                        modifier = Modifier.weight(1f),
                                    ) {
                                        Icon(if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = null)
                                        Text(if (isSaved) " Saved" else " Save to Ledger")
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            val clipboard = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                            val clip = ClipData.newPlainText(
                                                "DealDex",
                                                "🔥 DealDex: ${card.name} (${card.setName} #${card.localId}) · Ask: $%.2f · Book: $%.2f (%+.1f%%) · Flip Net: $%.2f · https://dealdex.net/card/${card.id}".format(allIn, book, spread * 100, flipNet),
                                            )
                                            clipboard.setPrimaryClip(clip)
                                            Toast.makeText(ctx, "Deal copied to clipboard", Toast.LENGTH_SHORT).show()
                                        },
                                    ) {
                                        Icon(Icons.Default.Share, contentDescription = "Share")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
