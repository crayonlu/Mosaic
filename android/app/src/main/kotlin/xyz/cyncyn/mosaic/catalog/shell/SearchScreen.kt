package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.catalog.data.ConnectionStore
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.token.MoodKey
import xyz.cyncyn.mosaic.design.token.moodTokens

/**
 * 全屏搜索：关键词 + 标签 + 时间范围筛选，命中结果点开详情。
 * 搜索请求发往服务端；离线时回落到本地缓存过滤（repo 内处理）。
 */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchScreen(
    repo: DataRepository,
    connection: ConnectionStore,
    onClose: () -> Unit,
    onOpenMemo: (String) -> Unit,
) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()
    val focusRequester = remember { FocusRequester() }

    var query by rememberSaveable { mutableStateOf("") }
    var selectedTags by rememberSaveable { mutableStateOf(listOf<String>()) }
    var startDate by rememberSaveable { mutableStateOf<String?>(null) }
    var endDate by rememberSaveable { mutableStateOf<String?>(null) }
    var results by remember { mutableStateOf<List<MemoWithResources>>(emptyList()) }
    var searched by remember { mutableStateOf(false) }
    var searching by remember { mutableStateOf(false) }
    var allTags by remember { mutableStateOf(listOf<xyz.cyncyn.mosaic.data.model.TagCount>()) }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
        allTags = runCatching { repo.tags() }.getOrDefault(emptyList())
    }

    fun runSearch() {
        searching = true
        scope.launch {
            val response = runCatching {
                repo.search(query, selectedTags, startDate, endDate)
            }.getOrNull()
            results = response?.memos ?: emptyList()
            searched = true
            searching = false
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MosaicTheme.colors.background),
    ) {
        // header: back + input
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(MosaicTheme.shapes.pill)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = MosaicPressIndication,
                        onClick = onClose,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                MosaicText(text = "‹", style = MosaicTheme.typography.titleLarge, color = colors.text)
            }
            Box(
                Modifier
                    .weight(1f)
                    .clip(MosaicTheme.shapes.pill)
                    .background(colors.surface)
                    .border(1.dp, colors.borderStrong, MosaicTheme.shapes.pill)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                if (query.isEmpty()) {
                    MosaicText(text = "搜索关键词…", style = MosaicTheme.typography.body, color = colors.textTertiary)
                }
                androidx.compose.foundation.text.BasicTextField(
                    value = query,
                    onValueChange = { query = it },
                    textStyle = MosaicTheme.typography.body.copy(color = colors.text),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(colors.text),
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester),
                )
            }
            Box(
                Modifier
                    .clip(MosaicTheme.shapes.medium)
                    .background(colors.primary)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = MosaicPressIndication,
                        onClick = { runSearch() },
                    )
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                MosaicText(
                    text = if (searching) "搜索中" else "搜索",
                    style = MosaicTheme.typography.label,
                    color = colors.onPrimary,
                )
            }
        }

        // filters
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FilterChip(
                    text = "全部",
                    selected = selectedTags.isEmpty() && startDate == null,
                    onClick = {
                        selectedTags = emptyList()
                        startDate = null
                        endDate = null
                    },
                )
                allTags.take(6).forEach { tag ->
                    FilterChip(
                        text = "#${tag.tag}",
                        selected = tag.tag in selectedTags,
                        onClick = {
                            selectedTags = if (tag.tag in selectedTags) {
                                selectedTags - tag.tag
                            } else {
                                selectedTags + tag.tag
                            }
                        },
                    )
                }
                FilterChip(
                    text = "本周",
                    selected = startDate != null,
                    onClick = {
                        if (startDate == null) {
                            val fmt = java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
                            startDate = java.time.LocalDate.now().minusDays(7).format(fmt)
                            endDate = java.time.LocalDate.now().format(fmt)
                        } else {
                            startDate = null
                            endDate = null
                        }
                    },
                )
            }
        }

        // results
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (searched && results.isEmpty() && !searching) {
                item {
                    MosaicText(
                        text = "没有匹配的记录",
                        style = MosaicTheme.typography.body,
                        color = colors.textTertiary,
                        modifier = Modifier.padding(vertical = 32.dp),
                    )
                }
            }
            items(results.size, key = { results[it].id }) { index ->
                MemoCard(memo = results[index], onClick = { onOpenMemo(results[index].id) })
            }
        }
    }
}

@Composable
private fun FilterChip(text: String, selected: Boolean, onClick: () -> Unit) {
    val colors = MosaicTheme.colors
    Box(
        Modifier
            .clip(MosaicTheme.shapes.pill)
            .background(if (selected) colors.primarySoft else colors.surface)
            .border(1.dp, if (selected) colors.borderStrong else colors.border, MosaicTheme.shapes.pill)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = MosaicPressIndication,
                onClick = onClick,
            )
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        MosaicText(
            text = text,
            style = MosaicTheme.typography.label,
            color = if (selected) colors.primary else colors.textSecondary,
        )
    }
}
