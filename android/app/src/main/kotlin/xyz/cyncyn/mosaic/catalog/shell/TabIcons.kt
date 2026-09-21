package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// 24x24 stroke icons (lucide path data, ISC license).
private val BOOK = listOf("M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20")
private val CALENDAR = listOf(
    "M8 2v4",
    "M16 2v4",
    "M3 10h18",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
)
private val ARCHIVE = listOf(
    "M2 4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z",
    "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",
    "M10 12h4",
)
private val USER = listOf(
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
    "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
)
private val PLUS = listOf("M12 5v14", "M5 12h14")
private val SEARCH = listOf(
    "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16",
    "M21 21l-4.35-4.35",
)

@Composable
internal fun TabIcon(tab: Tab, size: Dp, color: Color) {
    val paths = when (tab) {
        Tab.Home -> BOOK
        Tab.Diary -> CALENDAR
        Tab.Archive -> ARCHIVE
        Tab.Mine -> USER
    }
    StrokeIcon(paths, size, color)
}

@Composable
internal fun PlusIcon(size: Dp, color: Color) {
    StrokeIcon(PLUS, size, color)
}

@Composable
internal fun SearchIcon(size: Dp, color: Color) {
    StrokeIcon(SEARCH, size, color)
}

@Composable
private fun StrokeIcon(pathData: List<String>, size: Dp, color: Color) {
    val paths = remember(pathData) {
        pathData.map { data: String -> PathParser().parsePathString(data).toPath() }
    }
    Canvas(Modifier.size(size)) {
        val scale = this.size.width / 24f
        withTransform({ scale(scale, scale, pivot = Offset.Zero) }) {
            val stroke = Stroke(
                width = 1.7.dp.toPx() / scale,
                cap = StrokeCap.Round,
                join = StrokeJoin.Round,
            )
            paths.forEach { path -> drawPath(path, color = color, style = stroke) }
        }
    }
}
