import Foundation

enum PaidDesks {
    static func blend(card: TcgCard, keys: DeskKeys) async -> Double? {
        var found: [Double] = []
        if !keys.justTcg.isEmpty, let n = await justTcg(card, keys.justTcg) { found.append(n) }
        if !keys.priceCharting.isEmpty, let n = await priceCharting(card, keys.priceCharting) { found.append(n) }
        if !keys.pokemonTcg.isEmpty, let n = await pokemonTcg(card, keys.pokemonTcg) { found.append(n) }
        guard !found.isEmpty else { return nil }
        return found.reduce(0, +) / Double(found.count)
    }

    private static func justTcg(_ card: TcgCard, _ key: String) async -> Double? {
        let q = enc("\(card.name) \(card.setName)")
        guard let url = URL(string: "https://api.justtcg.com/v1/cards?game=pokemon&q=\(q)&limit=3") else { return nil }
        var req = URLRequest(url: url)
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let data = try? await URLSession.shared.data(for: req).0,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let first = (json["data"] as? [[String: Any]])?.first else { return nil }
        return walk(first, ["marketPrice", "market", "price", "avgPrice", "nm"])
    }

    private static func priceCharting(_ card: TcgCard, _ token: String) async -> Double? {
        let q = enc("\(card.name) \(card.setName) pokemon")
        guard let url = URL(string: "https://www.pricecharting.com/api/product?t=\(enc(token))&q=\(q)") else { return nil }
        guard let data = try? await URLSession.shared.data(for: URLRequest(url: url)).0,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let product = json["product"] as? [String: Any] ?? json
        if let cents = product["loose-price"] as? Int, cents > 0 { return Double(cents) / 100 }
        return walk(product, ["loose-price", "ungraded-price"])
    }

    private static func pokemonTcg(_ card: TcgCard, _ key: String) async -> Double? {
        let q = enc("name:\"\(card.name)\" set.name:\"\(card.setName)\"")
        guard let url = URL(string: "https://api.pokemontcg.io/v2/cards?q=\(q)&pageSize=1") else { return nil }
        var req = URLRequest(url: url)
        req.setValue(key, forHTTPHeaderField: "X-Api-Key")
        guard let data = try? await URLSession.shared.data(for: req).0,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let row = (json["data"] as? [[String: Any]])?.first else { return nil }
        return walk(row["tcgplayer"], ["market"])
    }

    private static func walk(_ obj: Any?, _ keys: Set<String>, depth: Int = 0) -> Double? {
        guard depth < 5 else { return nil }
        if let n = obj as? Double, n > 0, n < 1_000_000 { return n }
        if let n = obj as? Int, n > 0 { return Double(n) }
        guard let dict = obj as? [String: Any] else {
            if let arr = obj as? [Any] {
                for item in arr { if let n = walk(item, keys, depth: depth + 1) { return n } }
            }
            return nil
        }
        for k in keys {
            if let n = walk(dict[k], keys, depth: depth + 1) { return n }
        }
        for v in dict.values {
            if let n = walk(v, keys, depth: depth + 1) { return n }
        }
        return nil
    }

    private static func enc(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? s
    }
}
