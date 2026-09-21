package xyz.cyncyn.mosaic.design.token

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/** The eight moods tracked by the app. Content colors, shared by every direction. */
enum class MoodKey(val label: String) {
    Joy("喜悦"),
    Anger("愤怒"),
    Sadness("悲伤"),
    Calm("平静"),
    Anxiety("焦虑"),
    Focus("专注"),
    Tired("疲惫"),
    Neutral("平静无波"),
}

/**
 * Mood colors as a ramp instead of a single mid-tone, so chips stay readable
 * in both modes and the hue survives theme changes.
 */
@Immutable
data class MoodToken(
    val container: Color,
    val onContainer: Color,
    val border: Color,
)

fun moodTokens(isDark: Boolean): Map<MoodKey, MoodToken> = if (isDark) {
    mapOf(
        MoodKey.Joy to MoodToken(Color(0xFF46351F), Color(0xFFE7CFAF), Color(0xFF5C472C)),
        MoodKey.Anger to MoodToken(Color(0xFF47201D), Color(0xFFE4B3AE), Color(0xFF5E2F2B)),
        MoodKey.Sadness to MoodToken(Color(0xFF1F2F45), Color(0xFFB2C6E0), Color(0xFF2C3F5B)),
        MoodKey.Calm to MoodToken(Color(0xFF1B3A30), Color(0xFFADCEC3), Color(0xFF27503F)),
        MoodKey.Anxiety to MoodToken(Color(0xFF42301B), Color(0xFFE0C2A2), Color(0xFF574126)),
        MoodKey.Focus to MoodToken(Color(0xFF2C2545), Color(0xFFC2B9E0), Color(0xFF3B3259)),
        MoodKey.Tired to MoodToken(Color(0xFF2A313A), Color(0xFFC1C7CF), Color(0xFF3A4450)),
        MoodKey.Neutral to MoodToken(Color(0xFF33312B), Color(0xFFD9D6CC), Color(0xFF454239)),
    )
} else {
    mapOf(
        MoodKey.Joy to MoodToken(Color(0xFFE9D6BE), Color(0xFF4A3520), Color(0xFFD8BE9F)),
        MoodKey.Anger to MoodToken(Color(0xFFE7BCB7), Color(0xFF5A2622), Color(0xFFD6A19B)),
        MoodKey.Sadness to MoodToken(Color(0xFFB7CBE3), Color(0xFF25384F), Color(0xFF9CB4D2)),
        MoodKey.Calm to MoodToken(Color(0xFFB2D1C6), Color(0xFF22443A), Color(0xFF96BCAE)),
        MoodKey.Anxiety to MoodToken(Color(0xFFE3C7AB), Color(0xFF54371C), Color(0xFFD1AF8D)),
        MoodKey.Focus to MoodToken(Color(0xFFC7BFDF), Color(0xFF332B52), Color(0xFFB0A6CE)),
        MoodKey.Tired to MoodToken(Color(0xFFC6CCD3), Color(0xFF333A44), Color(0xFFAEB6C0)),
        MoodKey.Neutral to MoodToken(Color(0xFFDDDBD2), Color(0xFF45423A), Color(0xFFC8C5BA)),
    )
}
