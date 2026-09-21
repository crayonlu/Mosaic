package xyz.cyncyn.mosaic.design

import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.cyncyn.mosaic.design.theme.ThemeDirection
import xyz.cyncyn.mosaic.design.token.mosaicTypography
import xyz.cyncyn.mosaic.design.token.moodTokens
import xyz.cyncyn.mosaic.design.theme.semanticColors

/**
 * Token-level guarantees: type scale uses sp (accessibility), every direction
 * exposes both modes, mood ramps stay complete.
 */
class TokensTest {

    @Test
    fun `typography is defined in sp for font scaling`() {
        val typography = mosaicTypography()
        assertEquals(28, typography.display.fontSize.value.toInt())
        assertEquals(15, typography.body.fontSize.value.toInt())
        assertTrue(typography.caption.lineHeight > typography.caption.fontSize)
    }

    @Test
    fun `every direction has light and dark palettes with distinct canvases`() {
        for (direction in ThemeDirection.entries) {
            val light = semanticColors(direction, dark = false)
            val dark = semanticColors(direction, dark = true)
            assertTrue("$direction light canvas must differ from dark", light.background != dark.background)
            assertTrue("$direction isDark flag", !light.isDark && dark.isDark)
        }
    }

    @Test
    fun `ink direction canvas matches the locked palette`() {
        val ink = semanticColors(ThemeDirection.Ink, dark = false)
        assertEquals(0xFFF6F4EF.toInt(), ink.background.hashCode())
        val inkDark = semanticColors(ThemeDirection.Ink, dark = true)
        assertEquals(0xFF171614.toInt(), inkDark.background.hashCode())
    }

    @Test
    fun `mood ramp covers all eight keys in both modes`() {
        val light = moodTokens(false)
        val dark = moodTokens(true)
        assertEquals(8, light.size)
        assertEquals(8, dark.size)
        for ((key, token) in light) {
            assertTrue(key.label.isNotEmpty())
            assertTrue(token.container != token.onContainer)
        }
    }
}
