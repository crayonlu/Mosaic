package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import xyz.cyncyn.mosaic.catalog.MiniSwitch
import xyz.cyncyn.mosaic.catalog.data.AppGraph
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MosaicPressIndication
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * 我的 → 设置族子页：账户连接 / AI 与机器人 / 外观 / 同步与存储 / 关于。
 * 每页都是真实现：写偏好、发请求、即时生效。
 */

internal enum class SettingsPage(val title: String) {
    Account("账户与连接"),
    Bots("AI 与机器人"),
    Appearance("外观"),
    SyncStorage("同步与存储"),
    About("关于 Mosaic"),
}

@Composable
internal fun SettingsSubPage(
    page: SettingsPage,
    repo: DataRepository,
    graph: AppGraph,
    onBack: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(MosaicTheme.colors.background),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .padding(0.dp)
                    .height(40.dp)
                    .fillMaxWidth(0.15f)
                    .clip(MosaicTheme.shapes.pill)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = MosaicPressIndication,
                        onClick = onBack,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                MosaicText(text = "‹", style = MosaicTheme.typography.titleLarge, color = MosaicTheme.colors.text)
            }
            MosaicText(
                text = page.title,
                style = MosaicTheme.typography.title,
                color = MosaicTheme.colors.text,
                modifier = Modifier
                    .padding(start = 4.dp)
                    .weight(1f),
            )
        }
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            when (page) {
                SettingsPage.Account -> AccountSection(repo, graph)
                SettingsPage.Bots -> BotsSection(repo)
                SettingsPage.Appearance -> AppearanceSection(graph)
                SettingsPage.SyncStorage -> SyncStorageSection(repo, graph)
                SettingsPage.About -> AboutSection()
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ------------------------------------------------------------ 账户与连接 ----

@Composable
private fun AccountSection(repo: DataRepository, graph: AppGraph) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()
    val authState by repo.authState.collectAsState()
    val user = (authState as? DataRepository.AuthState.LoggedIn)?.user

    var serverUrl by rememberSaveable { mutableStateOf(graph.connection.baseUrl) }
    var savedUrl by rememberSaveable { mutableStateOf(graph.connection.baseUrl) }
    var healthMessage by remember { mutableStateOf<String?>(null) }

    MosaicText(text = "当前用户", style = MosaicTheme.typography.label, color = colors.textSecondary)
    SettingGroup(rows = listOf("用户名：${user?.username ?: "-"}", "ID：${user?.id?.take(13) ?: "-"}"))

    MosaicText(text = "服务端", style = MosaicTheme.typography.label, color = colors.textSecondary)
    SettingGroup(rows = listOf("地址：$savedUrl"))
    InputField(value = serverUrl, onValueChange = { serverUrl = it }, hint = "http://10.0.2.2:18080")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MosaicButton(
            text = "保存并测试",
            variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Outline,
            onClick = {
                scope.launch {
                    graph.connection.baseUrl = serverUrl
                    savedUrl = graph.connection.baseUrl
                    healthMessage = runCatching { "已连接 · v${graph.api.health().version}" }
                        .getOrElse { "连接失败：${it.message}" }
                }
            },
        )
        healthMessage?.let {
            Box(Modifier.align(Alignment.CenterVertically)) {
                MosaicText(text = it, style = MosaicTheme.typography.label, color = colors.textTertiary)
            }
        }
    }

    MosaicButton(
        text = "退出登录",
        variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Soft,
        onClick = { scope.launch { repo.logout() } },
    )
}

// ------------------------------------------------------------ AI 与机器人 ---

@Composable
private fun BotsSection(repo: DataRepository) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()
    val bots by repo.bots.collectAsState()

    LaunchedEffect(Unit) { runCatching { repo.syncNow() } }

    if (bots.isEmpty()) {
        MosaicText(text = "还没有机器人（服务端未配置）", style = MosaicTheme.typography.body, color = colors.textTertiary)
        return
    }
    bots.forEach { bot ->
        var enabled by remember(bot.id) { mutableStateOf(bot.autoReply) }
        Column(
            Modifier
                .fillMaxWidth()
                .clip(MosaicTheme.shapes.large)
                .background(colors.surface)
                .border(1.dp, colors.border, MosaicTheme.shapes.large)
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MosaicText(
                    text = bot.name,
                    style = MosaicTheme.typography.title,
                    color = colors.text,
                    modifier = Modifier.weight(1f),
                )
                MiniSwitch(checked = enabled, onChange = { next ->
                    enabled = next
                    scope.launch { runCatching { repo.setBotAutoReply(bot.id, next) } }
                })
            }
            MosaicText(text = bot.description, style = MosaicTheme.typography.body, color = colors.textSecondary)
            MosaicText(
                text = "自动回复 ${if (enabled) "开" else "关"} · 记忆 ${bot.memoryStats?.totalContextsBuilt ?: 0} 条",
                style = MosaicTheme.typography.caption,
                color = colors.textTertiary,
            )
        }
    }
}

// ---------------------------------------------------------------- 外观 -----

@Composable
private fun AppearanceSection(graph: AppGraph) {
    val colors = MosaicTheme.colors
    val mode by graph.theme.mode.collectAsState()

    MosaicText(text = "主题", style = MosaicTheme.typography.label, color = colors.textSecondary)
    SettingGroup(rows = listOf("方向：墨与宣（Ink）"))

    MosaicText(text = "明暗", style = MosaicTheme.typography.label, color = colors.textSecondary)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("system" to "跟随系统", "light" to "浅色", "dark" to "深色").forEach { (value, label) ->
            MosaicButton(
                text = label,
                variant = if (mode == value) {
                    xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Filled
                } else {
                    xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Outline
                },
                onClick = { graph.theme.set(value) },
            )
        }
    }
    MosaicText(
        text = "切换即时全局生效",
        style = MosaicTheme.typography.caption,
        color = colors.textTertiary,
    )
}

// ----------------------------------------------------------- 同步与存储 ----

@Composable
private fun SyncStorageSection(repo: DataRepository, graph: AppGraph) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()
    val lastSyncAt by repo.lastSyncAt.collectAsState()
    val cursors by repo.cursors.collectAsState()
    val memos by repo.memos.collectAsState()
    val diaries by repo.diaries.collectAsState()
    var busy by remember { mutableStateOf(false) }

    MosaicText(text = "同步", style = MosaicTheme.typography.label, color = colors.textSecondary)
    SettingGroup(
        rows = listOf(
            "上次同步：${lastSyncAt?.let { formatTime(it) } ?: "未同步"}",
            "游标 memo：${cursors?.memo ?: "-"} · diary：${cursors?.diary ?: "-"}",
        ),
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MosaicButton(
            text = if (busy) "同步中…" else "立即同步",
            enabled = !busy,
            onClick = {
                scope.launch {
                    busy = true
                    repo.syncNow()
                    busy = false
                }
            },
        )
        MosaicButton(
            text = "清空本地缓存",
            variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Outline,
            onClick = {
                scope.launch {
                    busy = true
                    repo.clearCache()
                    busy = false
                }
            },
        )
    }

    MosaicText(text = "本地缓存", style = MosaicTheme.typography.label, color = colors.textSecondary)
    SettingGroup(
        rows = listOf(
            "memo ${memos.size} 条 · 日记 ${diaries.size} 天",
            "缓存目录：files/cache（跨进程存活）",
        ),
    )
}

// ---------------------------------------------------------------- 关于 -----

@Composable
private fun AboutSection() {
    val colors = MosaicTheme.colors
    SettingGroup(
        rows = listOf(
            "Mosaic Android（Compose 重写）",
            "版本 0.1.0 · Compose 重写",
            "设计系统：design-core（零 Material 依赖）",
        ),
    )
    MosaicText(
        text = "墨与宣 · 暖纸画布，色彩只属于内容。",
        style = MosaicTheme.typography.caption,
        color = colors.textTertiary,
    )
}
