package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import xyz.cyncyn.mosaic.catalog.data.ConnectionStore
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.data.model.MemoWithResources

/**
 * 首页：搜索入口 + 真实 memo 流（本地缓存优先，启动即同步）。
 */

@Composable
internal fun HomePage(
    repo: DataRepository,
    connection: ConnectionStore,
    onOpenMemo: (String) -> Unit,
    onOpenSearch: () -> Unit,
) {
    val colors = MosaicTheme.colors
    val memos by repo.memos.collectAsState()
    val syncing by repo.syncing.collectAsState()
    val lastSyncAt by repo.lastSyncAt.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(MosaicTheme.shapes.pill)
                    .background(colors.surface)
                    .border(1.dp, colors.border, MosaicTheme.shapes.pill)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = MosaicPressIndication,
                        onClick = onOpenSearch,
                    )
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SearchIcon(16.dp, colors.textTertiary)
                MosaicText(
                    text = "搜索 memo、日记、标签",
                    style = MosaicTheme.typography.label,
                    color = colors.textTertiary,
                )
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val status = when {
                    syncing -> "正在同步…"
                    lastSyncAt != null -> "已同步 · ${formatTime(lastSyncAt!!)}"
                    else -> "本地缓存"
                }
                MosaicText(text = status, style = MosaicTheme.typography.caption, color = colors.textTertiary)
            }
        }
        if (memos.isEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MosaicText(text = "还没有记录", style = MosaicTheme.typography.title, color = colors.textSecondary)
                    MosaicText(
                        text = "点击底部的 + 记下第一条，或检查服务端连接",
                        style = MosaicTheme.typography.caption,
                        color = colors.textTertiary,
                    )
                }
            }
        }
        items(memos.size, key = { memos[it].id }) { index ->
            MemoCard(memo = memos[index], onClick = { onOpenMemo(memos[index].id) })
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
internal fun MemoCard(memo: MemoWithResources, onClick: () -> Unit) {
    val colors = MosaicTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.large)
            .background(colors.surface)
            .border(1.dp, colors.border, MosaicTheme.shapes.large)
            .clickable(
                interactionSource = interactionSource,
                indication = MosaicPressIndication,
                onClick = onClick,
            )
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            MosaicText(
                text = formatDate(memo.createdAt),
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
                modifier = Modifier.weight(1f),
            )
            if (memo.isArchived) {
                MosaicText(text = "已归档", style = MosaicTheme.typography.caption, color = colors.warning)
            }
            if (memo.resources.isNotEmpty()) {
                MosaicText(
                    text = "${memo.resources.size} 图",
                    style = MosaicTheme.typography.caption,
                    color = colors.textTertiary,
                )
            }
        }
        MosaicText(
            text = memo.content,
            style = MosaicTheme.typography.body,
            color = colors.text,
            maxLines = 5,
            overflow = TextOverflow.Ellipsis,
        )
        memo.aiSummary?.let {
            MosaicText(
                text = "AI · $it",
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (memo.tags.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                memo.tags.take(4).forEach { tag ->
                    Box(
                        Modifier
                            .clip(MosaicTheme.shapes.pill)
                            .background(colors.primarySoft)
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    ) {
                        MosaicText(text = "#$tag", style = MosaicTheme.typography.caption, color = colors.primary)
                    }
                }
            }
        }
    }
}

@Composable
internal fun formatTime(epochMs: Long): String = remember(epochMs) {
    java.text.SimpleDateFormat("HH:mm", java.util.Locale.CHINA).format(java.util.Date(epochMs))
}
