package xyz.cyncyn.mosaic.catalog.shell

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import xyz.cyncyn.mosaic.data.repo.DataRepository
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * 通知中心（custom-push 的本地部分）：同步/记录事件流水 + 系统本地通知。
 * 无 FCM；远端推送在非目标范围。
 */

private const val CHANNEL_ID = "mosaic_local"

fun postLocalNotification(context: Context, id: Long, title: String, body: String) {
    if (Build.VERSION.SDK_INT >= 33 &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
        return
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "本地通知", NotificationManager.IMPORTANCE_DEFAULT),
        )
    }
    val intent = Intent(context, Class.forName("xyz.cyncyn.mosaic.catalog.MainActivity"))
    val pending = PendingIntent.getActivity(
        context,
        (id % 100000).toInt(),
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val notification = android.app.Notification.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(title)
        .setContentText(body)
        .setContentIntent(pending)
        .setAutoCancel(true)
    manager.notify((id % 100000).toInt() and 0x7fffffff, notification.build())
}

@Composable
fun NotificationsPage(repo: DataRepository, onBack: () -> Unit) {
    val colors = MosaicTheme.colors
    val context = LocalContext.current
    val events by repo.events.collectAsState()

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    LaunchedEffect(events) {
        events.firstOrNull()?.let { event ->
            postLocalNotification(context, event.id, "Mosaic", event.message)
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background),
    ) {
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
                        indication = null,
                        onClick = onBack,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                MosaicText(text = "‹", style = MosaicTheme.typography.titleLarge, color = colors.text)
            }
            MosaicText(
                text = "通知中心",
                style = MosaicTheme.typography.title,
                color = colors.text,
                modifier = Modifier.weight(1f),
            )
        }
        if (events.isEmpty()) {
            MosaicText(
                text = "暂无通知。同步与记录动作会出现在这里。",
                style = MosaicTheme.typography.body,
                color = colors.textTertiary,
                modifier = Modifier.padding(16.dp),
            )
        }
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(events.size) { index ->
                val event = events[index]
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
                        text = event.message,
                        style = MosaicTheme.typography.body,
                        color = colors.text,
                    )
                    MosaicText(
                        text = formatTime(event.at),
                        style = MosaicTheme.typography.caption,
                        color = colors.textTertiary,
                    )
                }
            }
        }
    }
}
