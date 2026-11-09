import Foundation

enum AccountApi {
    struct Session { var token: String; var email: String }
    struct Keys { var justTcg: String; var priceCharting: String; var pokemonTcg: String }

    static func origin(_ raw: String) -> String {
        NativeAuth.normalized(raw)
    }

    // `signIn(email:password:)` used to live here.  It POSTed credentials to
    // /api/native/session, which the server has answered with 410 Gone since
    // email/password sign-in was removed.  Nothing called it.  Sign-in goes
    // through NativeAuth (Google/Apple/X + PKCE code exchange).

    static func pullKeys(origin: String, token: String) async throws -> Keys {
        var req = URLRequest(url: URL(string: "\(origin)/api/native/keys")!)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("DealDex/1.0 (ios)", forHTTPHeaderField: "User-Agent")
        let (data, res) = try await URLSession.shared.data(for: req)
        let code = (res as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 {
            throw NSError(domain: "DealDex", code: 401, userInfo: [NSLocalizedDescriptionKey: "Session expired. Sign in again."])
        }
        if code >= 400 {
            throw NSError(domain: "DealDex", code: code, userInfo: [NSLocalizedDescriptionKey: "Could not load keys."])
        }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        return Keys(
            justTcg: json["justtcg"] as? String ?? "",
            priceCharting: json["pricecharting"] as? String ?? "",
            pokemonTcg: json["pokemontcg"] as? String ?? ""
        )
    }

    static func pushKeys(origin: String, token: String, keys: DeskKeys) async throws {
        var req = URLRequest(url: URL(string: "\(origin)/api/native/keys")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("DealDex/1.0 (ios)", forHTTPHeaderField: "User-Agent")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "justtcg": keys.justTcg,
            "pricecharting": keys.priceCharting,
            "pokemontcg": keys.pokemonTcg,
        ])
        let (_, res) = try await URLSession.shared.data(for: req)
        let code = (res as? HTTPURLResponse)?.statusCode ?? 0
        if code >= 400 {
            throw NSError(domain: "DealDex", code: code, userInfo: [NSLocalizedDescriptionKey: "Website unreachable. Keys stay on this phone."])
        }
    }
}
