import Foundation
import Security

struct DeskKeys: Equatable {
    var justTcg = ""
    var priceCharting = ""
    var pokemonTcg = ""
    var any: Bool { !justTcg.isEmpty || !priceCharting.isEmpty || !pokemonTcg.isEmpty }
}

/// Keychain-backed storage for the values that are actually secrets.
///
/// The session token and the three paid desk API keys used to sit in
/// `UserDefaults`, which is a plist in the app container: readable from a device
/// backup and from any process that can reach the container. They are
/// credentials, so they belong in the Keychain with
/// `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — available to background
/// scans after the first unlock, and never carried to another device.
enum SecureStore {
    private static let service = "net.dealdex.credentials"

    static func read(_ key: String) -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    static func write(_ key: String, _ value: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        guard !value.isEmpty else {
            SecItemDelete(base as CFDictionary)
            return
        }
        let data = Data(value.utf8)
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(base as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var insert = base
            insert.merge(attrs) { current, _ in current }
            SecItemAdd(insert as CFDictionary, nil)
        }
    }
}

enum DeskStore {
    private static let d = UserDefaults.standard
    static let defaultOrigin = NativeAuth.defaultOrigin

    /// One-time move of credentials out of the plist and into the Keychain.
    ///
    /// Reads each value back before deleting the plist copy, and only latches
    /// the migration once every one verified.  Deleting on an unverified write
    /// and latching anyway would have silently destroyed a user's session token
    /// and paid desk keys on any device where the Keychain write failed, with
    /// no retry on the next launch.
    private static func migrateLegacyDefaults() {
        if let customOrigin = d.string(forKey: "dealdex.origin"), !customOrigin.isEmpty {
            let norm = NativeAuth.normalized(customOrigin)
            if norm != defaultOrigin {
                SecureStore.write("token", "")
                d.removeObject(forKey: "dealdex.email")
            }
            d.removeObject(forKey: "dealdex.origin")
        }
        guard !d.bool(forKey: "dealdex.securedV1") else { return }
        var allMoved = true
        for (defaultsKey, secureKey) in [
            ("dealdex.token", "token"),
            ("dealdex.justtcg", "justtcg"),
            ("dealdex.pricecharting", "pricecharting"),
            ("dealdex.pokemontcg", "pokemontcg"),
        ] {
            guard let legacy = d.string(forKey: defaultsKey), !legacy.isEmpty else { continue }
            SecureStore.write(secureKey, legacy)
            if SecureStore.read(secureKey) == legacy {
                d.removeObject(forKey: defaultsKey)
            } else {
                allMoved = false
            }
        }
        if allMoved { d.set(true, forKey: "dealdex.securedV1") }
    }

    static var keys: DeskKeys {
        get {
            migrateLegacyDefaults()
            return DeskKeys(
                justTcg: SecureStore.read("justtcg"),
                priceCharting: SecureStore.read("pricecharting"),
                pokemonTcg: SecureStore.read("pokemontcg")
            )
        }
        set {
            SecureStore.write("justtcg", newValue.justTcg)
            SecureStore.write("pricecharting", newValue.priceCharting)
            SecureStore.write("pokemontcg", newValue.pokemonTcg)
        }
    }

    static var origin: String {
        defaultOrigin
    }

    static var token: String {
        get {
            migrateLegacyDefaults()
            return SecureStore.read("token")
        }
        set { SecureStore.write("token", newValue) }
    }

    /// Not a secret — the signed-in address is shown in the UI.
    static var email: String {
        get { d.string(forKey: "dealdex.email") ?? "" }
        set { d.set(newValue, forKey: "dealdex.email") }
    }

    static var signedIn: Bool { !token.isEmpty }
}
