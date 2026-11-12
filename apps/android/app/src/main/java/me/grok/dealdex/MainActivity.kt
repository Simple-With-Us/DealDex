package me.grok.dealdex

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.TravelExplore
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import me.grok.dealdex.ui.AlertsScreen
import me.grok.dealdex.ui.CardDossierScreen
import me.grok.dealdex.ui.DealDexTheme
import me.grok.dealdex.ui.DeskViewModel
import me.grok.dealdex.ui.EvaluatorScreen
import me.grok.dealdex.ui.SavedScreen
import me.grok.dealdex.ui.ScanScreen
import me.grok.dealdex.ui.SettingsScreen
import io.sentry.compose.SentryTraced

class MainActivity : ComponentActivity() {
    private val vm: DeskViewModel by viewModels()
    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val playUpdateLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) {}
    private val playUpdateOffer = mutableStateOf<AppUpdateInfo?>(null)
    private lateinit var playUpdateManager: AppUpdateManager
    private var offeredPlayUpdateThisSession = false

    @OptIn(ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        // Android 15 (API 35) draws apps edge to edge whether or not they ask.
        // Declaring it means Scaffold's insets are the ones that apply.
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        playUpdateManager = AppUpdateManagerFactory.create(this)
        handleAuth(intent)
        setContent {
            SentryTraced("MainActivity") {
            DealDexTheme {
                val nav = rememberNavController()
                val state by vm.state.collectAsState()
                val route = nav.currentBackStackEntryAsState().value?.destination?.route
                val playOffer = playUpdateOffer.value
                Scaffold(
                    bottomBar = {
                        NavigationBar {
                            NavigationBarItem(
                                selected = route == "scan",
                                onClick = { nav.navigate("scan") { launchSingleTop = true } },
                                icon = { Icon(Icons.Outlined.TravelExplore, contentDescription = null) },
                                label = { Text("Scan") },
                            )
                            NavigationBarItem(
                                selected = route == "evaluator",
                                onClick = { nav.navigate("evaluator") { launchSingleTop = true } },
                                icon = { Icon(Icons.Outlined.Tune, contentDescription = null) },
                                label = { Text("Evaluator") },
                            )
                            NavigationBarItem(
                                selected = route == "saved",
                                onClick = { nav.navigate("saved") { launchSingleTop = true } },
                                icon = { Icon(Icons.Outlined.BookmarkBorder, contentDescription = null) },
                                label = { Text("Saved") },
                            )
                            NavigationBarItem(
                                selected = route == "alerts",
                                onClick = { nav.navigate("alerts") { launchSingleTop = true } },
                                icon = { Icon(Icons.Outlined.Notifications, contentDescription = null) },
                                label = { Text("Alerts") },
                            )
                            NavigationBarItem(
                                selected = route == "settings",
                                onClick = { nav.navigate("settings") { launchSingleTop = true } },
                                icon = { Icon(Icons.Outlined.Settings, contentDescription = null) },
                                label = { Text("Settings") },
                            )
                        }
                    },
                ) { pad ->
                    NavHost(nav, startDestination = "scan", modifier = Modifier.padding(pad)) {
                        composable("scan") {
                            ScanScreen(
                                vm,
                                state,
                                onOpenDossier = { card ->
                                    vm.openDossier(card)
                                    nav.navigate("dossier")
                                },
                            )
                        }
                        composable("evaluator") { EvaluatorScreen(vm, state.evaluatorCard) }
                        composable("saved") { SavedScreen(vm, state) }
                        composable("dossier") {
                            val card = state.activeDossierCard
                            if (card != null) {
                                CardDossierScreen(
                                    card = card,
                                    onBack = { nav.popBackStack() },
                                    onOpenEvaluator = { c: me.grok.dealdex.data.TcgCard ->
                                        vm.openEvaluator(c)
                                        nav.navigate("evaluator")
                                    },
                                )
                            }
                        }
                        composable("alerts") { AlertsScreen(vm, state) }
                        composable("settings") { SettingsScreen(vm, state) }
                    }
                }
                if (playOffer != null) {
                    AlertDialog(
                        onDismissRequest = { skipPlayUpdate(playOffer) },
                        title = { Text(getString(R.string.play_update_title)) },
                        text = { Text(getString(R.string.play_update_message)) },
                        confirmButton = {
                            TextButton(onClick = { startPlayUpdate(playOffer) }) {
                                Text(getString(R.string.play_update_confirm))
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = { skipPlayUpdate(playOffer) }) {
                                Text(getString(R.string.play_update_not_now))
                            }
                        },
                    )
                }
            }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        checkPlayUpdate()
    }

    /**
     * Ask for notification permission the first time the user actually turns an
     * alert on, not at cold start. Firing it from `onCreate` put the system
     * dialog in front of someone who had not yet seen a single listing, which is
     * the reliable way to collect a permanent denial.
     */
    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleAuth(intent)
    }

    /**
     * Consume the sign-in redirect exactly once.
     *
     * The redirect used to carry the token itself, so re-parsing it on every
     * activity recreation was harmless.  It now carries a SINGLE-USE code, and
     * the launching intent survives rotation — so a re-handle would spend an
     * already-redeemed code and overwrite a good session with "Sign-in
     * expired".  Clearing `data` makes the second pass a no-op.
     */
    private fun handleAuth(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "dealdex") return
        intent.data = null
        setIntent(intent)
        vm.completeOAuth(data)
    }

    private fun checkPlayUpdate() {
        if (!::playUpdateManager.isInitialized) return
        playUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    playUpdateManager.completeUpdate()
                    return@addOnSuccessListener
                }
                if (offeredPlayUpdateThisSession) return@addOnSuccessListener
                val skipped = getSharedPreferences(PlayUpdatePrompt.PREFS_NAME, Context.MODE_PRIVATE)
                    .getInt(PlayUpdatePrompt.SKIPPED_VERSION_CODE_KEY, 0)
                val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                val flexible = info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                if (!PlayUpdatePrompt.shouldOffer(
                        available,
                        flexible,
                        info.availableVersionCode(),
                        skipped,
                    )
                ) {
                    return@addOnSuccessListener
                }
                offeredPlayUpdateThisSession = true
                playUpdateOffer.value = info
            }
            .addOnFailureListener { }
    }

    private fun startPlayUpdate(info: AppUpdateInfo) {
        playUpdateOffer.value = null
        try {
            playUpdateManager.startUpdateFlowForResult(
                info,
                playUpdateLauncher,
                AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
            )
        } catch (_: Exception) {
        }
    }

    private fun skipPlayUpdate(info: AppUpdateInfo) {
        getSharedPreferences(PlayUpdatePrompt.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(PlayUpdatePrompt.SKIPPED_VERSION_CODE_KEY, info.availableVersionCode())
            .apply()
        playUpdateOffer.value = null
    }
}
