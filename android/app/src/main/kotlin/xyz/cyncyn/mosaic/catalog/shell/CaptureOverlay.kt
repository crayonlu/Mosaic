package xyz.cyncyn.mosaic.catalog.shell

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * Capture-anywhere overlay: scrim + paper card rising from the bottom.
 * Back gesture dismisses (predictive back compatible via BackHandler).
 */
@Composable
fun CaptureOverlay(
    visible: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit,
) {
    BackHandler(enabled = visible) { onDismiss() }

    val interactionSource = remember { MutableInteractionSource() }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(150)),
        exit = fadeOut(tween(130)),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(MosaicTheme.colors.scrim)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    onClick = onDismiss,
                ),
        )
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(tween(220)) { it } + fadeIn(tween(150)),
        exit = slideOutVertically(tween(180)) { it } + fadeOut(tween(130)),
        modifier = Modifier.fillMaxSize(),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            CaptureCard(onDismiss = onDismiss, onSubmit = onSubmit)
        }
    }
}

@Composable
private fun CaptureCard(onDismiss: () -> Unit, onSubmit: (String) -> Unit) {
    val colors = MosaicTheme.colors
    var text by rememberSaveable { mutableStateOf("") }
    val focusRequester = remember { androidx.compose.ui.focus.FocusRequester() }

    // 浮层出现即聚焦：打开就能直接写
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(120)
        focusRequester.requestFocus()
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.large)
            .background(colors.surface)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .align(Alignment.CenterHorizontally)
                .padding(top = 2.dp)
                .background(colors.borderStrong, MosaicTheme.shapes.pill)
                .padding(horizontal = 18.dp, vertical = 2.dp),
        )
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 96.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            if (text.isEmpty()) {
                MosaicText(
                    text = "此刻的想法…",
                    style = MosaicTheme.typography.bodyLarge,
                    color = colors.textTertiary,
                )
            }
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                textStyle = MosaicTheme.typography.bodyLarge.copy(color = colors.text),
                cursorBrush = SolidColor(colors.text),
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.weight(1f),
            ) {
                listOf("今天", "工作", "灵感").forEach { tag ->
                    Box(
                        Modifier
                            .clip(MosaicTheme.shapes.pill)
                            .background(colors.surfaceStrong)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = MosaicPressIndication,
                                onClick = { text = (text.trim() + " #$tag").trim() },
                            )
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        MosaicText(
                            text = "#$tag",
                            style = MosaicTheme.typography.label,
                            color = colors.link,
                        )
                    }
                }
            }
            MosaicButton(
                text = "收进纸间",
                onClick = {
                    if (text.isNotBlank()) onSubmit(text)
                    onDismiss()
                },
                enabled = text.isNotBlank(),
                variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Filled,
            )
        }
    }
}
