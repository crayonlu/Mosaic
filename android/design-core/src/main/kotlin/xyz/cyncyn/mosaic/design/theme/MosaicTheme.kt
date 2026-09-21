package xyz.cyncyn.mosaic.design.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.foundation.isSystemInDarkTheme
import xyz.cyncyn.mosaic.design.token.MosaicColors
import xyz.cyncyn.mosaic.design.token.MosaicMotion
import xyz.cyncyn.mosaic.design.token.MosaicShapes
import xyz.cyncyn.mosaic.design.token.MosaicTypography
import xyz.cyncyn.mosaic.design.token.mosaicMotion
import xyz.cyncyn.mosaic.design.token.mosaicShapes
import xyz.cyncyn.mosaic.design.token.mosaicTypography

val LocalMosaicColors = staticCompositionLocalOf<MosaicColors> {
    error("No MosaicTheme provided")
}
val LocalMosaicTypography = staticCompositionLocalOf { mosaicTypography() }
val LocalMosaicShapes = staticCompositionLocalOf { mosaicShapes }
val LocalMosaicMotion = staticCompositionLocalOf { mosaicMotion }

object MosaicTheme {
    val colors: MosaicColors
        @Composable get() = LocalMosaicColors.current
    val typography: MosaicTypography
        @Composable get() = LocalMosaicTypography.current
    val shapes: MosaicShapes
        @Composable get() = LocalMosaicShapes.current
    val motion: MosaicMotion
        @Composable get() = LocalMosaicMotion.current
}

/**
 * Root theme provider. [direction] selects one of the four candidate
 * palettes; [darkTheme] defaults to following the system.
 */
@Composable
fun MosaicTheme(
    direction: ThemeDirection,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = remember(direction, darkTheme) { semanticColors(direction, darkTheme) }
    val typography = remember { mosaicTypography() }
    val shapes = remember { mosaicShapes }
    val motion = remember { mosaicMotion }

    CompositionLocalProvider(
        LocalMosaicColors provides colors,
        LocalMosaicTypography provides typography,
        LocalMosaicShapes provides shapes,
        LocalMosaicMotion provides motion,
        content = content,
    )
}
