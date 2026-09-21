package xyz.cyncyn.mosaic.design.token

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.runtime.Immutable

/**
 * Motion tokens. Durations mirror the RN Animations constants; springs are
 * the preferred specs on Compose and are defined where used.
 */
@Immutable
data class MosaicMotion(
    val durationFast: Int = 150,
    val durationMedium: Int = 300,
    val durationSlow: Int = 500,
    val easingStandard: CubicBezierEasing = CubicBezierEasing(0.2f, 0f, 0f, 1f),
    val easingEmphasized: CubicBezierEasing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f),
)

val mosaicMotion = MosaicMotion()
