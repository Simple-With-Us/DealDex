package me.grok.dealdex.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.material3.Typography
import androidx.compose.ui.unit.sp

private val Paper = Color(0xFFF3EFE6)
private val Surface = Color(0xFFFFFCF6)
private val Ink = Color(0xFF1A1B16)
private val Olive = Color(0xFF3F4A32)
private val Muted = Color(0xFF5B594F)
private val Good = Color(0xFF3F5A38)
private val Fair = Color(0xFF7A6638)
private val Bad = Color(0xFF8F4E44)

val DealGood = Good
val DealFair = Fair
val DealBad = Bad

private val Light = lightColorScheme(
    primary = Olive,
    onPrimary = Paper,
    background = Paper,
    onBackground = Ink,
    surface = Surface,
    onSurface = Ink,
    surfaceVariant = Color(0xFFECE6D8),
    onSurfaceVariant = Muted,
    outline = Color(0xFFD4CEBF),
    secondary = Olive,
    onSecondary = Paper,
)

private val Dark = darkColorScheme(
    primary = Color(0xFFE4DFD2),
    onPrimary = Color(0xFF12130F),
    background = Color(0xFF0C0D0B),
    onBackground = Color(0xFFECEAE4),
    surface = Color(0xFF151612),
    onSurface = Color(0xFFECEAE4),
    surfaceVariant = Color(0xFF1C1D19),
    onSurfaceVariant = Color(0xFF9A978C),
    outline = Color(0xFF2A2B26),
)

private val Type = Typography(
    headlineLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Medium, fontSize = 32.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Medium, fontSize = 24.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Medium, fontSize = 20.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 12.sp, letterSpacing = 1.2.sp),
)

@Composable
fun DealDexTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (dark) Dark else Light, typography = Type, content = content)
}
