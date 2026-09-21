package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import xyz.cyncyn.mosaic.catalog.CatalogActivity
import xyz.cyncyn.mosaic.catalog.data.AppGraph
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * 我的（设置入口）。日记与归档已拆分至各自的文件。
 */

@Composable
internal fun MinePage(
    repo: DataRepository,
    graph: AppGraph,
    onOpenSettings: (SettingsPage) -> Unit,
    onOpenNotifications: () -> Unit,
) {
    val colors = MosaicTheme.colors
    val context = LocalContext.current
    val authState by repo.authState.collectAsState()
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        MosaicText(text = "我的", style = MosaicTheme.typography.titleLarge, color = colors.text)
        val user = (authState as? DataRepository.AuthState.LoggedIn)?.user
        Row(
            Modifier
                .fillMaxWidth()
                .clip(MosaicTheme.shapes.large)
                .background(colors.surface)
                .border(1.dp, colors.border, MosaicTheme.shapes.large)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .weight(1f),
            ) {
                MosaicText(
                    text = user?.username ?: "-",
                    style = MosaicTheme.typography.titleLarge,
                    color = colors.text,
                )
                MosaicText(
                    text = "已登录 · ${graph.connection.baseUrl}",
                    style = MosaicTheme.typography.caption,
                    color = colors.textTertiary,
                    modifier = Modifier.padding(top = 26.dp),
                )
            }
        }
        SettingGroup(
            rows = listOf(
                SettingsPage.Account.title,
                SettingsPage.Bots.title,
                SettingsPage.Appearance.title,
                SettingsPage.SyncStorage.title,
                SettingsPage.About.title,
            ),
            onClick = { row ->
                SettingsPage.entries.firstOrNull { it.title == row }?.let(onOpenSettings)
            },
        )
        SettingGroup(
            rows = listOf("通知中心", "设计目录", "开发者选项"),
            onClick = { row ->
                when (row) {
                    "通知中心" -> onOpenNotifications()
                    "设计目录" -> context.startActivity(android.content.Intent(context, CatalogActivity::class.java))
                }
            },
        )
        MosaicText(
            text = "Mosaic Android · Compose 重写",
            style = MosaicTheme.typography.caption,
            color = colors.textTertiary,
        )
    }
}

@Composable
internal fun SettingGroup(rows: List<String>, onClick: ((String) -> Unit)? = null) {
    val colors = MosaicTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.large)
            .background(colors.surface)
            .border(1.dp, colors.border, MosaicTheme.shapes.large),
    ) {
        rows.forEachIndexed { index, row ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .then(
                        if (onClick != null) {
                            Modifier.clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = { onClick(row) },
                            )
                        } else {
                            Modifier
                        },
                    )
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MosaicText(
                    text = row,
                    style = MosaicTheme.typography.body,
                    color = colors.text,
                    modifier = Modifier.weight(1f),
                )
                MosaicText(
                    text = "›",
                    style = MosaicTheme.typography.title,
                    color = colors.textTertiary,
                )
            }
            if (index != rows.lastIndex) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(start = 16.dp)
                        .height(1.dp)
                        .background(colors.border),
                )
            }
        }
    }
}
