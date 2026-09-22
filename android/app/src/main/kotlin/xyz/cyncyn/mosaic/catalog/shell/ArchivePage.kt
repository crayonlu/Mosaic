package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.data.model.MemoWithResources
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * 归档（管理视图）：筛选 + 批量选择 + 删除（真实 DELETE 回传服务端）+ 归档切换。
 */

private enum class ArchiveFilter(val label: String) {
    All("全部"),
    Archived("已归档"),
    WithImage("有图"),
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ArchivePage(repo: DataRepository, onOpenMemo: (String) -> Unit) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()
    val memos by repo.memos.collectAsState()
    val tags by produceTags(repo)

    var filter by rememberSaveable { mutableStateOf(ArchiveFilter.All) }
    var tagFilter by rememberSaveable { mutableStateOf<String?>(null) }
    var selecting by rememberSaveable { mutableStateOf(false) }
    var selected by rememberSaveable { mutableStateOf(setOf<String>()) }
    var confirmingDelete by rememberSaveable { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    val visible = remember(memos, filter, tagFilter) {
        memos.filter { memo ->
            val passFilter = when (filter) {
                ArchiveFilter.All -> true
                ArchiveFilter.Archived -> memo.isArchived
                ArchiveFilter.WithImage -> memo.resources.isNotEmpty()
            }
            passFilter && (tagFilter == null || tagFilter in memo.tags)
        }
    }

    Column(Modifier.fillMaxSize()) {
        // header + filters + action bar
        Column(
            Modifier
                .fillMaxWidth()
                .background(colors.background)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MosaicText(
                    text = "归档",
                    style = MosaicTheme.typography.titleLarge,
                    color = colors.text,
                    modifier = Modifier.weight(1f),
                )
                MosaicText(
                    text = if (selecting) "已选 ${selected.size}" else "${visible.size} 条",
                    style = MosaicTheme.typography.label,
                    color = colors.textTertiary,
                )
            }
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                ArchiveFilter.entries.forEach { f ->
                    FilterChip2(
                        text = f.label,
                        selected = filter == f,
                        onClick = {
                            filter = f
                            tagFilter = null
                        },
                    )
                }
                tags.take(5).forEach { tag ->
                    FilterChip2(
                        text = "#${tag.tag}",
                        selected = tagFilter == tag.tag,
                        onClick = { tagFilter = if (tagFilter == tag.tag) null else tag.tag },
                    )
                }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (!selecting) {
                    MosaicButton(
                        text = "批量管理",
                        variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Outline,
                        onClick = {
                            selecting = true
                            selected = emptySet()
                        },
                    )
                } else {
                    MosaicButton(
                        text = if (selected.isEmpty()) "选择条目" else "全选",
                        variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Ghost,
                        onClick = {
                            selected = if (selected.size == visible.size) emptySet() else visible.map { it.id }.toSet()
                        },
                    )
                    MosaicButton(
                        text = if (confirmingDelete) "确认删除 ${selected.size} 条？" else "删除",
                        enabled = selected.isNotEmpty(),
                        variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Soft,
                        onClick = {
                            if (confirmingDelete) {
                                confirmingDelete = false
                                busy = true
                                scope.launch {
                                    selected.forEach { id ->
                                        runCatching { repo.deleteMemo(id) }
                                    }
                                    selected = emptySet()
                                    selecting = false
                                    busy = false
                                }
                            } else {
                                confirmingDelete = true
                            }
                        },
                    )
                    MosaicButton(
                        text = "归档",
                        enabled = selected.isNotEmpty() && !busy,
                        variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Ghost,
                        onClick = {
                            busy = true
                            scope.launch {
                                selected.forEach { id ->
                                    runCatching { repo.setMemoArchived(id, true) }
                                }
                                selected = emptySet()
                                busy = false
                            }
                        },
                    )
                    MosaicButton(
                        text = "取消",
                        variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Ghost,
                        onClick = {
                            selecting = false
                            selected = emptySet()
                            confirmingDelete = false
                        },
                    )
                }
            }
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (visible.isEmpty()) {
                item {
                    MosaicText(
                        text = "这个筛选下没有记录",
                        style = MosaicTheme.typography.body,
                        color = colors.textTertiary,
                        modifier = Modifier.padding(vertical = 40.dp),
                    )
                }
            }
            items(visible.size, key = { visible[it].id }) { index ->
                val memo = visible[index]
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (selecting) {
                        SelectDot(
                            checked = memo.id in selected,
                            onClick = {
                                selected = if (memo.id in selected) selected - memo.id else selected + memo.id
                            },
                        )
                    }
                    Box(Modifier.weight(1f)) {
                        MemoCard(memo = memo, onClick = {
                            if (selecting) {
                                selected = if (memo.id in selected) selected - memo.id else selected + memo.id
                            } else {
                                onOpenMemo(memo.id)
                            }
                        })
                    }
                }
            }
        }
    }
}

@Composable
private fun produceTags(repo: DataRepository): androidx.compose.runtime.State<List<xyz.cyncyn.mosaic.data.model.TagCount>> {
    return androidx.compose.runtime.produceState(initialValue = emptyList()) {
        value = runCatching { repo.tags() }.getOrDefault(emptyList())
    }
}

@Composable
private fun FilterChip2(text: String, selected: Boolean, onClick: () -> Unit) {
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

@Composable
private fun SelectDot(checked: Boolean, onClick: () -> Unit) {
    val colors = MosaicTheme.colors
    Box(
        Modifier
            .padding(end = 10.dp)
            .size(24.dp)
            .clip(CircleShape)
            .background(if (checked) colors.primary else colors.surface)
            .border(
                width = 1.5.dp,
                color = if (checked) colors.primary else colors.borderStrong,
                shape = CircleShape,
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = MosaicPressIndication,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (checked) {
            MosaicText(text = "✓", style = MosaicTheme.typography.caption, color = colors.onPrimary)
        }
    }
}
