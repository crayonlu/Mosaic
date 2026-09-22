package xyz.cyncyn.mosaic.catalog.shell

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.catalog.data.AppGraph
import xyz.cyncyn.mosaic.catalog.data.ConnectionStore
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.data.model.MemoDetail
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Memo detail: markdown body, tags, resources, revisions, bot replies.
 * Delete performs a real DELETE against the server.
 */
@Composable
fun MemoDetailScreen(
    repo: DataRepository,
    memoId: String,
    connection: ConnectionStore,
    graph: xyz.cyncyn.mosaic.catalog.data.AppGraph,
    onBack: () -> Unit,
    onDeleted: () -> Unit,
) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val detailState by produceState<MemoDetail?>(initialValue = null, key1 = memoId) {
        value = runCatching { repo.memoDetail(memoId) }
            .onFailure { e -> android.util.Log.w("MosaicDetail", "detail load failed for $memoId", e) }
            .getOrNull()
    }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }

    BackHandler { onBack() }

    Column(
        Modifier
            .fillMaxSize()
            .background(MosaicTheme.colors.background),
    ) {
        // header
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(MosaicTheme.shapes.pill)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = MosaicPressIndication,
                        onClick = onBack,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                MosaicText(text = "‹", style = MosaicTheme.typography.titleLarge, color = colors.text)
            }
            MosaicText(
                text = "详情",
                style = MosaicTheme.typography.title,
                color = colors.text,
                modifier = Modifier.weight(1f),
            )
            Box(
                Modifier
                    .clip(MosaicTheme.shapes.pill)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = MosaicPressIndication,
                        onClick = { confirmDelete = !confirmDelete },
                    )
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                MosaicText(text = "删除", style = MosaicTheme.typography.label, color = colors.error)
            }
        }

        val detail = detailState
        if (detailState == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                MosaicText(text = "加载中…", style = MosaicTheme.typography.label, color = colors.textTertiary)
            }
            return@Column
        }
        if (detail == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                MosaicText(text = "内容不存在或已删除", style = MosaicTheme.typography.body, color = colors.textTertiary)
            }
            return@Column
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            MosaicText(
                text = formatDate(detail.memo.createdAt),
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
            )
            if (detail.memo.isArchived) {
                MosaicText(text = "已归档", style = MosaicTheme.typography.label, color = colors.warning)
            }
            MarkdownBody(source = detail.memo.content)

            if (detail.memo.tags.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    detail.memo.tags.forEach { tag ->
                        Box(
                            Modifier
                                .clip(MosaicTheme.shapes.pill)
                                .background(colors.primarySoft)
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        ) {
                            MosaicText(text = "#$tag", style = MosaicTheme.typography.caption, color = colors.primary)
                        }
                    }
                }
            }

            detail.memo.aiSummary?.let { summary ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(MosaicTheme.shapes.medium)
                        .background(colors.surface)
                        .border(1.dp, colors.border, MosaicTheme.shapes.medium)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    MosaicText(text = "AI 摘要", style = MosaicTheme.typography.label, color = colors.textSecondary)
                    MosaicText(text = summary, style = MosaicTheme.typography.body, color = colors.text)
                }
            }

            if (detail.memo.resources.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    detail.memo.resources.take(3).forEach { resource ->
                        val bitmap by produceState<androidx.compose.ui.graphics.ImageBitmap?>(initialValue = null, key1 = resource.id) {
                            value = graph.fetchResourceBitmap(connection.absolutePath(resource.url))
                        }
                        Box(
                            Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .clip(MosaicTheme.shapes.medium)
                                .background(colors.surfaceMuted),
                            contentAlignment = Alignment.Center,
                        ) {
                            val image = bitmap
                            if (image != null) {
                                androidx.compose.foundation.Image(
                                    bitmap = image,
                                    contentDescription = resource.filename,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            } else {
                                MosaicText(text = "…", style = MosaicTheme.typography.caption, color = colors.textTertiary)
                            }
                        }
                    }
                }
            }

            if (detail.revisions.isNotEmpty()) {
                MosaicText(text = "编辑历史 · ${detail.revisions.size}", style = MosaicTheme.typography.title, color = colors.text)
                detail.revisions.forEach { revision ->
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
                            text = "v${revision.revisionNumber} · ${formatDate(revision.createdAt)}",
                            style = MosaicTheme.typography.caption,
                            color = colors.textTertiary,
                        )
                        MosaicText(
                            text = revision.content,
                            style = MosaicTheme.typography.body,
                            color = colors.textSecondary,
                            maxLines = 4,
                        )
                    }
                }
            }

            if (detail.botReplies.isNotEmpty()) {
                MosaicText(text = "Bot 回复", style = MosaicTheme.typography.title, color = colors.text)
                detail.botReplies.forEach { reply ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(MosaicTheme.shapes.medium)
                            .background(colors.primarySoft)
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        MosaicText(
                            text = reply.bot?.name ?: "Bot",
                            style = MosaicTheme.typography.label,
                            color = colors.primary,
                        )
                        MosaicText(text = reply.content, style = MosaicTheme.typography.body, color = colors.text)
                    }
                }
            }

            if (confirmDelete) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(MosaicTheme.shapes.medium)
                        .background(colors.errorContainer)
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    MosaicText(text = "删除这条 memo？", style = MosaicTheme.typography.label, color = colors.error)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MosaicButton(
                            text = "确认删除",
                            onClick = {
                                confirmDelete = false
                                scope.launch {
                                    runCatching { repo.deleteMemo(memoId) }
                                    onDeleted()
                                }
                            },
                            variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Soft,
                        )
                        MosaicButton(
                            text = "取消",
                            onClick = { confirmDelete = false },
                            variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Ghost,
                        )
                    }
                }
            }

            Box(Modifier.size(24.dp))
        }
    }
}

@Composable
internal fun formatDate(epochMs: Long): String = remember(epochMs) {
    SimpleDateFormat("M月d日 EEEE HH:mm", Locale.CHINA).format(Date(epochMs))
}

@Composable
private fun MosaicButton(text: String, onClick: () -> Unit, variant: xyz.cyncyn.mosaic.design.component.MosaicButtonVariant, enabled: Boolean = true) {
    xyz.cyncyn.mosaic.design.component.MosaicButton(text = text, onClick = onClick, variant = variant, enabled = enabled)
}
