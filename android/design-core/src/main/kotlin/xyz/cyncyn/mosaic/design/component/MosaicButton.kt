package xyz.cyncyn.mosaic.design.component

import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.node.DelegatingNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * Press feedback for the whole system: a subtle scale-down while pressed.
 * Deliberately not a Material ripple — this is the design language's own
 * response, drawn in the draw phase so presses never recompose.
 */
object MosaicPressIndication : IndicationNodeFactory {

    override fun create(interactionSource: InteractionSource): DelegatingNode =
        PressScaleNode(interactionSource)

    override fun equals(other: Any?): Boolean = other === this

    override fun hashCode(): Int = System.identityHashCode(this)
}

private class PressScaleNode(
    private val interactionSource: InteractionSource,
) : DelegatingNode(), DrawModifierNode {

    private var pressed = false

    override fun onAttach() {
        coroutineScope.launch {
            interactionSource.interactions.collect { interaction ->
                when (interaction) {
                    is PressInteraction.Press -> pressed = true
                    is PressInteraction.Release -> pressed = false
                    is PressInteraction.Cancel -> pressed = false
                }
            }
        }
    }

    override fun ContentDrawScope.draw() {
        if (pressed) {
            scale(0.97f, 0.97f) { this@draw.drawContent() }
        } else {
            drawContent()
        }
    }
}

enum class MosaicButtonVariant { Filled, Soft, Outline, Ghost }

@Composable
fun MosaicButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MosaicButtonVariant = MosaicButtonVariant.Filled,
    enabled: Boolean = true,
    leading: (@Composable () -> Unit)? = null,
) {
    val colors = MosaicTheme.colors
    val shapes = MosaicTheme.shapes

    val backgroundColor: Color
    val contentColor: Color
    val showBorder: Boolean
    when (variant) {
        MosaicButtonVariant.Filled -> {
            backgroundColor = colors.primary
            contentColor = colors.onPrimary
            showBorder = false
        }
        MosaicButtonVariant.Soft -> {
            backgroundColor = colors.primarySoft
            contentColor = colors.primary
            showBorder = false
        }
        MosaicButtonVariant.Outline -> {
            backgroundColor = colors.surface
            contentColor = colors.primary
            showBorder = true
        }
        MosaicButtonVariant.Ghost -> {
            backgroundColor = Color.Transparent
            contentColor = colors.link
            showBorder = false
        }
    }

    val disabledAlpha = 0.42f
    val background = if (enabled) backgroundColor else backgroundColor.copy(alpha = disabledAlpha)
    val content = if (enabled) contentColor else contentColor.copy(alpha = disabledAlpha)

    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier = modifier
            .clip(shapes.medium)
            .clickable(
                interactionSource = interactionSource,
                indication = MosaicPressIndication,
                enabled = enabled,
                onClick = onClick,
            )
            .background(background, shapes.medium)
            .then(
                if (showBorder) {
                    Modifier.border(
                        width = 1.dp,
                        color = if (enabled) colors.borderStrong else colors.border,
                        shape = shapes.medium,
                    )
                } else {
                    Modifier
                },
            )
            .defaultMinSize(minHeight = 44.dp)
            .padding(horizontal = 20.dp, vertical = 11.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            leading?.invoke()
            MosaicText(text = text, style = MosaicTheme.typography.label, color = content)
        }
    }
}
