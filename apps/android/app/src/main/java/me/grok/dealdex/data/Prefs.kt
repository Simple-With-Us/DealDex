package me.grok.dealdex.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * On-device storage.
 *
 * Split deliberately in two:
 *
 *  - [secure] holds the session token, the PKCE verifier and the three paid desk
 *    API keys. These are credentials. They used to sit in a plain
 *    `MODE_PRIVATE` SharedPreferences file inside a manifest that set
 *    `android:allowBackup="true"`, so Android auto-backup was eligible to copy
 *    every one of them off the device.
 *  - [plain] holds the rest (origin, signed-in email), which is not secret and
 *    is cheaper to read.
 *
 * `allowBackup` is now false, and credentials go through
 * `EncryptedSharedPreferences`, so the file is useless without the
 * hardware-backed master key.  If the keystore is unavailable the store falls
 * back to MEMORY, never to a plaintext file — see [secure].
 */
class Prefs(private val ctx: Context) {
    private val plain: SharedPreferences = ctx.getSharedPreferences("dealdex", Context.MODE_PRIVATE)

    init {
        // The `spreaddex` -> `dealdex` rename only moves non-secret values, so
        // it is cheap and can stay eager.  Credentials move lazily with [secure].
        if (!plain.contains("migrated")) {
            val old = ctx.getSharedPreferences("spreaddex", Context.MODE_PRIVATE)
            val e = plain.edit()
            for ((k, v) in old.all) {
                if (!plain.contains(k) && v is String) e.putString(k, v)
            }
            e.putBoolean("migrated", true).apply()
        }
    }

    /**
     * Where credentials live.
     *
     * Lazy on purpose: building a [MasterKey] generates an AndroidKeyStore
     * AES-256-GCM key on first launch, and doing that in the constructor put a
     * keystore round trip on the main thread inside `onCreate`.
     *
     * The fallback is deliberately IN MEMORY, not a second file.  An earlier
     * version fell back to a plain `MODE_PRIVATE` file, which combined badly
     * with R8: strip Tink's reflectively-registered key managers and
     * `EncryptedSharedPreferences.create` throws, so the release build would
     * have written the session token and all three paid desk keys to disk in
     * the clear — silently, and while the privacy page said otherwise.  Losing
     * the session on a broken keystore is a far better failure than that.
     */
    private val secure: SecretStore by lazy {
        runCatching {
            val masterKey = MasterKey.Builder(ctx)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedStore(
                EncryptedSharedPreferences.create(
                    ctx,
                    "dealdex.secure",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
                ),
            ) as SecretStore
        }.getOrElse { MemoryStore() }.also(::migrateLegacy)
    }

    /** Minimal get/put surface, so the fallback does not have to be a file. */
    private interface SecretStore {
        fun get(key: String): String
        fun put(key: String, value: String)
    }

    private class EncryptedStore(private val prefs: SharedPreferences) : SecretStore {
        override fun get(key: String) = prefs.getString(key, "").orEmpty()
        override fun put(key: String, value: String) {
            prefs.edit().putString(key, value).apply()
        }
    }

    /** Process-lifetime only.  The user signs in again next launch. */
    private class MemoryStore : SecretStore {
        private val map = HashMap<String, String>()
        override fun get(key: String) = map[key].orEmpty()
        override fun put(key: String, value: String) {
            map[key] = value
        }
    }

    /**
     * One-time move: the old `spreaddex` file, then any credentials still
     * sitting in the plain `dealdex` file, into [store].
     *
     * Each value is read back before its plaintext copy is deleted, and the
     * migration only latches once every one verified — otherwise a failed write
     * would destroy the user's token and keys with no retry on next launch.
     */
    private fun migrateLegacy(store: SecretStore) {
        if (plain.getBoolean("securedV1", false)) return
        var allMoved = true
        for (key in SECRET_KEYS) {
            val legacy = plain.getString(key, "").orEmpty()
            if (legacy.isBlank()) continue
            if (store.get(key).isBlank()) store.put(key, legacy)
            if (store.get(key) == legacy) {
                plain.edit().remove(key).apply()
            } else {
                allMoved = false
            }
        }
        if (allMoved) plain.edit().putBoolean("securedV1", true).apply()
    }

    private fun secret(key: String) = secure.get(key)
    private fun setSecret(key: String, v: String) = secure.put(key, v)

    var justTcg: String
        get() = secret("justtcg")
        set(v) = setSecret("justtcg", v)
    var priceCharting: String
        get() = secret("pricecharting")
        set(v) = setSecret("pricecharting", v)
    var pokemonTcg: String
        get() = secret("pokemontcg")
        set(v) = setSecret("pokemontcg", v)
    var token: String
        get() = secret("token")
        set(v) = setSecret("token", v)

    /** PKCE verifier for an in-flight sign-in. Cleared once redeemed. */
    var authVerifier: String
        get() = secret("auth_verifier")
        set(v) = setSecret("auth_verifier", v)

    var origin: String
        get() = plain.getString("origin", "") ?: ""
        set(v) {
            plain.edit().putString("origin", v.trim().trimEnd('/')).apply()
        }

    /** Not a secret — shown in the account screen. */
    var email: String
        get() = plain.getString("email", "") ?: ""
        set(v) {
            plain.edit().putString("email", v).apply()
        }

    fun signedIn() = token.isNotBlank()

    private companion object {
        val SECRET_KEYS = listOf("justtcg", "pricecharting", "pokemontcg", "token")
    }
}
