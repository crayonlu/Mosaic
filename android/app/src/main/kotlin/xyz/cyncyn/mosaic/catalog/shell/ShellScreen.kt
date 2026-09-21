package xyz.cyncyn.mosaic.catalog.shell

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.catalog.data.AppGraph
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

internal enum class Tab(val label: String) {
    Home("首页"),
    Diary("日记"),
    Archive("归档"),
    Mine("我的"),
}

@Composable
fun ShellScreen(graph: AppGraph) {
    val repo = graph.repository
    val scope = rememberCoroutineScope()
    val stateHolder = rememberSaveableStateHolder()
    var current by rememberSaveable { mutableStateOf(Tab.Home) }
    var captureOpen by rememberSaveable { mutableStateOf(false) }
    var detailId by rememberSaveable { mutableStateOf<String?>(null) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var settingsPage by rememberSaveable { mutableStateOf<SettingsPage?>(null) }
    var notificationsOpen by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        repo.syncNow()
    }

    BackHandler(enabled = detailId != null) { detailId = null }
    BackHandler(enabled = detailId == null && searchOpen) { searchOpen = false }
    BackHandler(enabled = detailId == null && !searchOpen && settingsPage != null) { settingsPage = null }
    BackHandler(enabled = detailId == null && !searchOpen && settingsPage == null && notificationsOpen) { notificationsOpen = false }

    Box(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing),
    ) {
        Column(Modifier.fillMaxSize()) {
            AnimatedContent(
                targetState = current,
                transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(140)) },
                label = "tabContent",
                modifier = Modifier.weight(1f),
            ) { tab ->
                stateHolder.SaveableStateProvider(tab.name) {
                    when (tab) {
                        Tab.Home -> HomePage(
                            repo = repo,
                            connection = graph.connection,
                            onOpenMemo = { detailId = it },
                            onOpenSearch = { searchOpen = true },
                        )
                        Tab.Diary -> DiaryPage(repo = repo)
                        Tab.Archive -> ArchivePage(
                            repo = repo,
                            onOpenMemo = { detailId = it },
                        )
                        Tab.Mine -> MinePage(
                            repo = repo,
                            graph = graph,
                            onOpenSettings = { settingsPage = it },
                            onOpenNotifications = { notificationsOpen = true },
                        )
                    }
                }
            }
            BottomBar(
                current = current,
                onSelect = { current = it },
                onCapture = { captureOpen = true },
            )
        }

        // pushed routes above the tab shell
        detailId?.let { id ->
            MemoDetailScreen(
                repo = repo,
                memoId = id,
                connection = graph.connection,
                graph = graph,
                onBack = { detailId = null },
                onDeleted = { detailId = null },
            )
        }
        if (notificationsOpen) {
            NotificationsPage(repo = repo, onBack = { notificationsOpen = false })
        }
        settingsPage?.let { page ->
            SettingsSubPage(
                page = page,
                repo = repo,
                graph = graph,
                onBack = { settingsPage = null },
            )
        }
        if (searchOpen) {
            SearchScreen(
                repo = repo,
                connection = graph.connection,
                onClose = { searchOpen = false },
                onOpenMemo = { detailId = it },
            )
        }

        CaptureOverlay(
            visible = captureOpen,
            onDismiss = { captureOpen = false },
            onSubmit = { content ->
                captureOpen = false
                scope.launch {
                    val tags = Regex("#([^\\s#]+)").findAll(content).map { it.groupValues[1] }.toList()
                    runCatching { repo.createMemo(content, tags) }
                }
            },
        )
    }
}

@Composable
private fun BottomBar(
    current: Tab,
    onSelect: (Tab) -> Unit,
    onCapture: () -> Unit,
) {
    val colors = MosaicTheme.colors
    Column(Modifier.fillMaxWidth().background(colors.surface)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(colors.border),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .height(66.dp)
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TabItem(Tab.Home, current == Tab.Home, Modifier.weight(1f)) { onSelect(Tab.Home) }
            TabItem(Tab.Diary, current == Tab.Diary, Modifier.weight(1f)) { onSelect(Tab.Diary) }
            CaptureSlot(Modifier.weight(1f), onCapture)
            TabItem(Tab.Archive, current == Tab.Archive, Modifier.weight(1f)) { onSelect(Tab.Archive) }
            TabItem(Tab.Mine, current == Tab.Mine, Modifier.weight(1f)) { onSelect(Tab.Mine) }
        }
    }
}

@Composable
private fun TabItem(
    tab: Tab,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val colors = MosaicTheme.colors
    val tint = if (selected) colors.text else colors.textTertiary
    val dotAlpha by animateFloatAsState(
        targetValue = if (selected) 1f else 0f,
        label = "tabDot",
    )
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier
            .clip(MosaicTheme.shapes.medium)
            .clickable(
                interactionSource = interactionSource,
                indication = MosaicPressIndication,
                onClick = onClick,
            )
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        TabIcon(tab, 22.dp, tint)
        Box(
            Modifier
                .size(4.dp)
                .graphicsLayer { alpha = dotAlpha }
                .clip(CircleShape)
                .background(tint),
        )
    }
}

@Composable
private fun CaptureSlot(modifier: Modifier, onClick: () -> Unit) {
    val colors = MosaicTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Box(modifier, contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .offset(y = (-14).dp)
                .size(52.dp)
                .then(
                    if (!colors.isDark) {
                        Modifier.dropShadow(
                            shape = CircleShape,
                            shadow = Shadow(
                                radius = 12.dp,
                                spread = 0.dp,
                                color = Color(0x33211F1B),
                                offset = DpOffset(0.dp, 4.dp),
                            ),
                        )
                    } else {
                        Modifier
                    },
                )
                .clip(CircleShape)
                .clickable(
                    interactionSource = interactionSource,
                    indication = MosaicPressIndication,
                    onClick = onClick,
                )
                .background(colors.primary),
            contentAlignment = Alignment.Center,
        ) {
            PlusIcon(22.dp, colors.onPrimary)
        }
    }
}
