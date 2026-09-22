package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.data.model.DiaryWithMemos
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.repo.DataRepository
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import xyz.cyncyn.mosaic.design.component.MoodChip
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.token.MoodKey
import xyz.cyncyn.mosaic.design.token.moodTokens
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * 日记页：无限按日翻页（HorizontalPager），每天展示日记摘要 + 心情（键位 + 拖杆）
 * + 当日 memo 列表；摘要与心情可编辑并回传 PUT /api/diaries/{date}。
 */

private val CENTER_PAGE = Int.MAX_VALUE / 2

private fun pageDate(page: Int): LocalDate =
    LocalDate.now().minusDays((CENTER_PAGE - page).toLong())

private val cnDayOfWeek = mapOf(
    java.time.DayOfWeek.MONDAY to "星期一",
    java.time.DayOfWeek.TUESDAY to "星期二",
    java.time.DayOfWeek.WEDNESDAY to "星期三",
    java.time.DayOfWeek.THURSDAY to "星期四",
    java.time.DayOfWeek.FRIDAY to "星期五",
    java.time.DayOfWeek.SATURDAY to "星期六",
    java.time.DayOfWeek.SUNDAY to "星期日",
)

private fun moodKeyOf(key: String): MoodKey =
    MoodKey.entries.firstOrNull { it.name.lowercase() == key.lowercase() } ?: MoodKey.Neutral

@Composable
internal fun DiaryPage(repo: DataRepository) {
    val pagerState = rememberPagerState(initialPage = CENTER_PAGE) { Int.MAX_VALUE }

    HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
        val date = remember(page) { pageDate(page) }
        DayPage(repo = repo, date = date)
    }
}

@Composable
private fun DayPage(repo: DataRepository, date: LocalDate) {
    val colors = MosaicTheme.colors
    val dateKey = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
    val scope = rememberCoroutineScope()

    // fetch-on-show: remote first, cache fallback (repo handles both)
    val diaryState by produceState<DiaryWithMemos?>(initialValue = null, key1 = dateKey) {
        value = repo.diary(dateKey)
    }
    val memos by repo.memos.collectAsState()
    val dayMemos = remember(memos, dateKey, diaryState) {
        memos.filter { it.diaryDate == dateKey }
    }

    var summary by rememberSaveable(dateKey) { mutableStateOf<String?>(null) }
    var moodScore by rememberSaveable(dateKey) { mutableStateOf<Int?>(null) }
    var moodKey by rememberSaveable(dateKey) { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var savedTick by remember { mutableStateOf(false) }

    val effectiveSummary = summary ?: diaryState?.summary ?: ""
    val effectiveMoodKey = moodKey ?: diaryState?.moodKey ?: "calm"
    val effectiveScore = moodScore ?: diaryState?.moodScore ?: 60
    val dirty = summary != null || moodKey != null || moodScore != null

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        MosaicText(
            text = "${date.monthValue}月${date.dayOfMonth}日",
            style = MosaicTheme.typography.display,
            color = colors.text,
        )
        MosaicText(
            text = cnDayOfWeek[date.dayOfWeek] ?: "",
            style = MosaicTheme.typography.caption,
            color = colors.textTertiary,
        )

        // summary card
        Column(
            Modifier
                .fillMaxWidth()
                .clip(MosaicTheme.shapes.large)
                .background(colors.surface)
                .border(1.dp, colors.border, MosaicTheme.shapes.large)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MosaicText(
                    text = "这一天的记录",
                    style = MosaicTheme.typography.title,
                    color = colors.text,
                    modifier = Modifier.weight(1f),
                )
                if (savedTick) {
                    MosaicText(text = "已保存", style = MosaicTheme.typography.caption, color = colors.success)
                }
            }
            xyz.cyncyn.mosaic.catalog.shell.InputField(
                value = effectiveSummary,
                onValueChange = {
                    summary = it
                    savedTick = false
                },
                hint = if (diaryState == null) "这一天还没有日记，写下几句…" else "编辑摘要…",
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MosaicButton(
                    text = if (saving) "保存中…" else if (dirty) "保存日记" else "已同步",
                    enabled = !saving && dirty,
                    onClick = {
                        scope.launch {
                            saving = true
                            runCatching {
                                repo.saveDiary(
                                    date = dateKey,
                                    summary = effectiveSummary,
                                    moodKey = effectiveMoodKey,
                                    moodScore = effectiveScore,
                                )
                            }
                            saving = false
                            savedTick = true
                        }
                    },
                )
            }
        }

        // mood section
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            MosaicText(text = "心情", style = MosaicTheme.typography.title, color = colors.text)
            FlowRowChips(
                selectedKey = effectiveMoodKey,
                onSelect = { key ->
                    moodKey = key.name.lowercase()
                    savedTick = false
                },
            )
            MoodDragBar(
                score = effectiveScore,
                onScoreChange = {
                    moodScore = it
                    savedTick = false
                },
            )
            MosaicText(
                text = "强度 $effectiveScore / 100",
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
            )
        }

        // memos of the day
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MosaicText(
                text = "关联 memo · ${dayMemos.size}",
                style = MosaicTheme.typography.title,
                color = colors.text,
            )
            if (dayMemos.isEmpty()) {
                MosaicText(
                    text = "这一天还没有关联 memo",
                    style = MosaicTheme.typography.caption,
                    color = colors.textTertiary,
                )
            }
            dayMemos.forEach { memo ->
                DayMemoRow(memo)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun FlowRowChips(selectedKey: String, onSelect: (MoodKey) -> Unit) {
    androidx.compose.foundation.layout.FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MoodKey.entries.forEach { mood ->
            MoodChip(
                mood = mood,
                selected = mood.name.lowercase() == selectedKey,
                onClick = { onSelect(mood) },
            )
        }
    }
}

/** 纸面心情拖杆：轨道 + 可点可拖的墨点，0-100。 */
@Composable
private fun MoodDragBar(score: Int, onScoreChange: (Int) -> Unit) {
    val colors = MosaicTheme.colors
    val fillToken = moodTokens(colors.isDark).getValue(MoodKey.Calm)
    var trackWidth by remember { mutableStateOf(1f) }
    val density = LocalDensity.current
    val knobSize = with(density) { 20.dp.toPx() }
    val knobOffset = with(density) {
        ((trackWidth - knobSize) * (score / 100f)).toDp()
    }

    Box(
        Modifier
            .fillMaxWidth()
            .height(28.dp)
            .onSizeChanged { trackWidth = it.width.toFloat().coerceAtLeast(1f) }
            .clip(MosaicTheme.shapes.pill)
            .background(colors.surfaceStrong)
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    onScoreChange((offset.x / size.width * 100).toInt().coerceIn(0, 100))
                }
            }
            .pointerInput(Unit) {
                detectDragGestures { change, _ ->
                    onScoreChange((change.position.x / size.width * 100).toInt().coerceIn(0, 100))
                }
            },
    ) {
        Box(
            Modifier
                .fillMaxWidth(score / 100f)
                .height(28.dp)
                .clip(MosaicTheme.shapes.pill)
                .background(fillToken.container),
        )
        Box(
            Modifier
                .align(Alignment.CenterStart)
                .offset(x = knobOffset)
                .size(20.dp)
                .clip(CircleShape)
                .background(colors.primary)
                .border(2.dp, colors.background, CircleShape),
        )
    }
}

@Composable
private fun DayMemoRow(memo: MemoWithResources) {
    val colors = MosaicTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.medium)
            .background(colors.surface)
            .border(1.dp, colors.border, MosaicTheme.shapes.medium)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        MosaicText(
            text = memo.content,
            style = MosaicTheme.typography.body,
            color = colors.text,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (memo.tags.isNotEmpty()) {
            MosaicText(
                text = memo.tags.joinToString(" ") { "#$it" },
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
            )
        }
    }
}
