package xyz.cyncyn.mosaic.catalog

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.theme.ThemeDirection

class CatalogActivity : ComponentActivity() {

    private var direction by mutableStateOf(ThemeDirection.Ink)
    private var dark by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applySystemBars()

        setContent {
            LaunchedEffect(dark) { applySystemBars() }
            MosaicTheme(direction = direction, darkTheme = dark) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(MosaicTheme.colors.background)
                        .windowInsetsPadding(WindowInsets.safeDrawing),
                ) {
                    CatalogScreen(
                        direction = direction,
                        dark = dark,
                        onDirectionChange = { direction = it },
                        onDarkChange = { dark = it },
                    )
                }
            }
        }
    }

    private fun applySystemBars() {
        val transparent = Color.Transparent.toArgb()
        val statusBar = if (dark) {
            SystemBarStyle.dark(transparent)
        } else {
            SystemBarStyle.light(transparent, 0x00000000)
        }
        val navigationBar = if (dark) {
            SystemBarStyle.dark(transparent)
        } else {
            SystemBarStyle.light(transparent, 0x00000000)
        }
        enableEdgeToEdge(statusBarStyle = statusBar, navigationBarStyle = navigationBar)
    }
}

@Composable
fun CatalogScreen(
    direction: ThemeDirection,
    dark: Boolean,
    onDirectionChange: (ThemeDirection) -> Unit,
    onDarkChange: (Boolean) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        CatalogHeader(direction, dark, onDirectionChange, onDarkChange)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp),
        ) {
            item { ColorSection() }
            item { TypeSection() }
            item { MoodSection() }
            item { ComponentSection() }
        }
    }
}

@Composable
private fun CatalogHeader(
    direction: ThemeDirection,
    dark: Boolean,
    onDirectionChange: (ThemeDirection) -> Unit,
    onDarkChange: (Boolean) -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(MosaicTheme.colors.surface),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MosaicText(
                text = "Mosaic 设计目录",
                style = MosaicTheme.typography.title,
                color = MosaicTheme.colors.text,
                modifier = Modifier.weight(1f),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                MosaicText(
                    text = "暗色",
                    style = MosaicTheme.typography.label,
                    color = MosaicTheme.colors.textSecondary,
                )
                MiniSwitch(checked = dark, onChange = onDarkChange)
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ThemeDirection.entries.forEach { candidate ->
                DirectionChip(
                    direction = candidate,
                    selected = candidate == direction,
                    onClick = { onDirectionChange(candidate) },
                )
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .height(1.dp)
                .background(MosaicTheme.colors.border),
        )
    }
}

@Composable
private fun DirectionChip(
    direction: ThemeDirection,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = MosaicTheme.colors
    val shapes = MosaicTheme.shapes
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        Modifier
            .clip(shapes.medium)
            .clickable(
                interactionSource = interactionSource,
                indication = MosaicPressIndication,
                onClick = onClick,
            )
            .background(if (selected) colors.primarySoft else colors.background, shapes.medium)
            .border(
                1.dp,
                if (selected) colors.primary else colors.border,
                shapes.medium,
            )
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        MosaicText(
            text = direction.label,
            style = MosaicTheme.typography.label,
            color = if (selected) colors.primary else colors.textSecondary,
        )
    }
}

@Composable
internal fun MiniSwitch(checked: Boolean, onChange: (Boolean) -> Unit) {
    val colors = MosaicTheme.colors
    val shapes = MosaicTheme.shapes
    val interactionSource = remember { MutableInteractionSource() }
    val knobOffset by animateDpAsState(
        targetValue = if (checked) 22.dp else 2.dp,
        label = "knobOffset",
    )
    Box(
        Modifier
            .width(46.dp)
            .height(26.dp)
            .clip(shapes.pill)
            .background(if (checked) colors.primary else colors.surfaceStrong)
            .clickable(
                interactionSource = interactionSource,
                indication = MosaicPressIndication,
                onClick = { onChange(!checked) },
            )
            .padding(2.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(
            Modifier
                .offset(x = knobOffset)
                .size(22.dp)
                .clip(CircleShape)
                .background(if (checked) colors.onPrimary else colors.background),
        )
    }
}
