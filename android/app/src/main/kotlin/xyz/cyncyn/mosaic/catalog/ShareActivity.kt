package xyz.cyncyn.mosaic.catalog

import android.content.Intent
import xyz.cyncyn.mosaic.catalog.data.AppGraph
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * 系统分享接收：文本直接成 memo；图片先上传资源再创建带图 memo。
 * 处理完即关闭（半透明主题，无感知）。
 */
class ShareActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val graph = (application as MosaicApp).graph

        when (intent?.action) {
            Intent.ACTION_SEND -> handleSend(graph)
            else -> finish()
        }
    }

    private fun handleSend(graph: AppGraph) {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        val stream = @Suppress("DEPRECATION") intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)

        lifecycleScope.launch {
            runCatching {
                when {
                    stream != null -> {
                        val bytes = contentResolver.openInputStream(stream)?.use { it.readBytes() }
                        if (bytes != null) {
                            val mimeType = contentResolver.getType(stream) ?: "image/png"
                            val filename = "share-${System.currentTimeMillis()}.${mimeType.substringAfter('/')}"
                            val resourceId = graph.uploadResource(bytes, filename, mimeType)
                            graph.repository.createMemo(
                                content = text ?: "分享了一张图片",
                                tags = listOf("分享"),
                                resourceIds = listOf(resourceId),
                            )
                        }
                    }
                    !text.isNullOrBlank() -> {
                        val tags = Regex("#([^\\s#]+)").findAll(text).map { it.groupValues[1] }.toList()
                        graph.repository.createMemo(text, tags)
                    }
                }
            }
            finish()
        }
    }
}
