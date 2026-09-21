package xyz.cyncyn.mosaic.design.token

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Semantic layer of the token system. UI code reads only these roles,
 * never the raw palette values behind them.
 *
 * Derived tones (surfaceMuted / surfaceStrong / textTertiary …) are explicit
 * colors instead of alpha overlays so dark themes can derive them differently
 * and screenshot tests stay deterministic.
 */
@Immutable
data class MosaicColors(
    // Background / surfaces
    val background: Color,
    val surface: Color,
    val surfaceMuted: Color,
    val surfaceStrong: Color,
    // Text hierarchy
    val text: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    // Interaction
    val primary: Color,
    val primarySoft: Color,
    val onPrimary: Color,
    val link: Color,
    // Lines
    val border: Color,
    val borderStrong: Color,
    // Status
    val success: Color,
    val successContainer: Color,
    val error: Color,
    val errorContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val info: Color,
    val infoContainer: Color,
    // System
    val scrim: Color,
    val isDark: Boolean,
)
