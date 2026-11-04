package me.grok.dealdex

object PlayUpdatePrompt {
    const val PREFS_NAME = "dealdex.play_update"
    const val SKIPPED_VERSION_CODE_KEY = "skippedVersionCode"
    const val TITLE = "Update Available"
    const val MESSAGE = "A newer version is on Google Play.  You can keep using this one."
    const val UPDATE = "Update"
    const val NOT_NOW = "Not Now"

    fun shouldOffer(
        updateAvailable: Boolean,
        flexibleAllowed: Boolean,
        availableVersionCode: Int,
        skippedVersionCode: Int,
    ): Boolean {
        if (!updateAvailable) return false
        if (!flexibleAllowed) return false
        if (skippedVersionCode > 0 && availableVersionCode <= skippedVersionCode) return false
        return true
    }
}
