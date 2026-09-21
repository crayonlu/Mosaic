package xyz.cyncyn.mosaic.catalog.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.VisualTransformation
import kotlinx.coroutines.launch
import xyz.cyncyn.mosaic.catalog.data.AppGraph
import xyz.cyncyn.mosaic.design.component.MosaicButton
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme

/**
 * Connection setup: server URL + credentials → login. Shown whenever the
 * session is logged out; the shell takes over once authState flips.
 */
@Composable
fun SetupScreen(graph: AppGraph) {
    val colors = MosaicTheme.colors
    val scope = rememberCoroutineScope()

    var serverUrl by rememberSaveable { mutableStateOf(graph.connection.baseUrl) }
    var username by rememberSaveable { mutableStateOf("admin") }
    var password by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var healthMessage by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(32.dp))
        MosaicText(text = "Mosaic", style = MosaicTheme.typography.display, color = colors.text)
        MosaicText(
            text = "连接到你的服务端开始使用。本地数据此后离线可用。",
            style = MosaicTheme.typography.body,
            color = colors.textSecondary,
        )
        Spacer(Modifier.height(8.dp))

        FieldLabel("服务端地址")
        InputField(
            value = serverUrl,
            onValueChange = { serverUrl = it },
            hint = "http://10.0.2.2:18080",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MosaicButton(
                text = if (busy) "测试中…" else "测试连接",
                variant = xyz.cyncyn.mosaic.design.component.MosaicButtonVariant.Outline,
                enabled = !busy,
                onClick = {
                    scope.launch {
                        busy = true
                        errorMessage = null
                        graph.connection.baseUrl = serverUrl
                        healthMessage = runCatching { graph.api.health().version }
                            .onFailure { healthMessage = null }
                            .map { "已连接 · v$it" }
                            .getOrElse { "连接失败：${it.message}" }
                        busy = false
                    }
                },
            )
            healthMessage?.let {
                Box(Modifier.align(Alignment.CenterVertically)) {
                    MosaicText(text = it, style = MosaicTheme.typography.label, color = colors.textTertiary)
                }
            }
        }

        FieldLabel("用户名")
        InputField(value = username, onValueChange = { username = it }, hint = "admin")
        FieldLabel("密码")
        InputField(
            value = password,
            onValueChange = { password = it },
            hint = "••••••••",
            visualTransformation = PasswordVisualTransformation(),
            keyboardType = KeyboardType.Password,
        )

        errorMessage?.let {
            MosaicText(text = it, style = MosaicTheme.typography.label, color = colors.error)
        }

        MosaicButton(
            text = if (busy) "登录中…" else "连接并登录",
            enabled = !busy && username.isNotBlank() && password.isNotBlank(),
            onClick = {
                scope.launch {
                    busy = true
                    errorMessage = null
                    graph.connection.baseUrl = serverUrl
                    runCatching { graph.repository.login(username, password) }
                        .onFailure { e ->
                            errorMessage = when {
                                e is xyz.cyncyn.mosaic.data.net.HttpException && e.message2 != null -> e.message2
                                else -> "登录失败：${e.toString().take(160)}"
                            }
                        }
                    busy = false
                }
            },
        )
        MosaicText(
            text = "密码仅用于登录，令牌保存在本机加密存储中。",
            style = MosaicTheme.typography.caption,
            color = colors.textTertiary,
        )
    }
}

@Composable
private fun FieldLabel(text: String) {
    MosaicText(
        text = text,
        style = MosaicTheme.typography.label,
        color = MosaicTheme.colors.textSecondary,
        modifier = Modifier.padding(bottom = 6.dp),
    )
}

@Composable
internal fun InputField(
    value: String,
    onValueChange: (String) -> Unit,
    hint: String,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardType: KeyboardType = KeyboardType.Ascii,
) {
    val colors = MosaicTheme.colors
    Box(
        Modifier
            .fillMaxWidth()
            .clip(MosaicTheme.shapes.medium)
            .background(colors.surface)
            .border(1.dp, colors.borderStrong, MosaicTheme.shapes.medium)
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        if (value.isEmpty()) {
            MosaicText(text = hint, style = MosaicTheme.typography.body, color = colors.textTertiary)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = MosaicTheme.typography.body.copy(color = colors.text),
            cursorBrush = SolidColor(colors.text),
            visualTransformation = visualTransformation,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
