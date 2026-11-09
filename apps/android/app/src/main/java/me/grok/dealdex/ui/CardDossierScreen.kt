package me.grok.dealdex.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowOutward
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import me.grok.dealdex.data.TcgCard
import java.net.URLEncoder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardDossierScreen(
    card: TcgCard,
    onBack: () -> Unit,
    onOpenEvaluator: (TcgCard) -> Unit,
) {
    val ctx = LocalContext.current
    var selectedFinish by remember { mutableStateOf(card.finishes.firstOrNull()?.id ?: "") }
    val activeFinish = card.finishes.firstOrNull { it.id == selectedFinish } ?: card.finishes.firstOrNull()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(card.name, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                tonalElevation = 1.dp,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        card.setName.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(card.name, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text(
                        "#${card.localId}${card.rarity?.let { " · $it" } ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Spacer(Modifier.height(12.dp))

                    if (activeFinish?.market != null) {
                        Text(
                            "$%.2f".format(activeFinish.market),
                            style = MaterialTheme.typography.headlineSmall,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "TCGPlayer Market · ${activeFinish.label}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    if (card.cardmarketEur != null) {
                        Text(
                            "Cardmarket Trend €%.2f".format(card.cardmarketEur),
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }

            if (card.finishes.size > 1) {
                Column {
                    Text(
                        "FINISHES",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(top = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        card.finishes.forEach { f ->
                            FilterChip(
                                selected = (selectedFinish == f.id || (selectedFinish.isEmpty() && f == card.finishes.first())),
                                onClick = { selectedFinish = f.id },
                                label = { Text("${f.label} ${f.market?.let { "$%.2f".format(it) } ?: ""}") },
                            )
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "MARKETPLACES & COMPS",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            val q = URLEncoder.encode("${card.name} ${card.setName}", "UTF-8")
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.tcgplayer.com/search/pokemon/product?q=$q")))
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("TCGPlayer")
                        Spacer(Modifier.height(4.dp))
                        Icon(Icons.Default.ArrowOutward, contentDescription = null)
                    }

                    OutlinedButton(
                        onClick = {
                            val q = URLEncoder.encode("${card.name} ${card.setName} ${card.localId}", "UTF-8")
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.ebay.com/sch/i.html?_nkw=$q&LH_Sold=1&LH_Complete=1&_sop=13")))
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        MarketplaceMark("ebay")
                        Text(" Sold", modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }

            Surface(
                shape = RoundedCornerShape(12.dp),
                tonalElevation = 1.dp,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "APPRAISE A LISTING",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { onOpenEvaluator(card) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.Tune, contentDescription = null)
                        Text("Open in Evaluator", modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
        }
    }
}
