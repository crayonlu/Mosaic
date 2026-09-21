package xyz.cyncyn.mosaic.catalog

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.runtime.collectAsState
import xyz.cyncyn.mosaic.catalog.shell.SetupScreen
import xyz.cyncyn.mosaic.catalog.shell.ShellScreen
import xyz.cyncyn.mosaic.design.component.MosaicText
import xyz.cyncyn.mosaic.design.theme.MosaicTheme
import xyz.cyncyn.mosaic.design.theme.ThemeDirection
import xyz.cyncyn.mosaic.data.repo.DataRepository

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val graph = (application as MosaicApp).graph

        setContent {
            androidx.compose.runtime.LaunchedEffect(Unit) {
                graph.repository.bootstrap()
            }
            val authState by graph.repository.authState.collectAsState()
            val themeMode by graph.theme.mode.collectAsState()
            val darkTheme = when (themeMode) {
                "light" -> false
                "dark" -> true
                else -> isSystemInDarkTheme()
            }

            MosaicTheme(direction = ThemeDirection.Ink, darkTheme = darkTheme) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(MosaicTheme.colors.background),
                ) {
                    when (authState) {
                        is DataRepository.AuthState.Unknown -> BootPlaceholder()
                        is DataRepository.AuthState.LoggedOut -> SetupScreen(graph = graph)
                        is DataRepository.AuthState.LoggedIn -> ShellScreen(graph = graph)
                    }
                }
            }
        }
    }
}

@Composable
private fun BootPlaceholder() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        MosaicText(text = "Mosaic", style = MosaicTheme.typography.display, color = MosaicTheme.colors.text)
    }
}
