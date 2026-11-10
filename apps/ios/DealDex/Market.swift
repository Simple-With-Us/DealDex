import Foundation

enum Market {
    private static let jina = "https://r.jina.ai/"
    private static let tcg = "https://api.tcgdex.net/v2/en"

    private static let http: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 25
        c.timeoutIntervalForResource = 45
        c.waitsForConnectivity = true
        return URLSession(configuration: c)
    }()

    /// Scan eBay and Mercari.
    ///
    /// ON-DEVICE FIRST, deliberately. `/privacy` says "the apps scan
    /// marketplaces from the device" and "they do not send those keys to DealDex
    /// servers" — but this used to call the website FIRST and POST all three
    /// paid desk keys with every scan, so the published privacy policy described
    /// something the app did not do.
    ///
    /// The website is now a fallback for when the phone cannot reach the
    /// marketplaces itself, and it is never given a key. Paid desks
    /// (`PaidDesks.blend`) only ever run here, against `DeskStore.keys`.
    static func scan(
        _ query: String,
        keys: DeskKeys = DeskKeys(),
        origin: String = DeskStore.defaultOrigin,
        sources: [String] = ["ebay", "mercari"]
    ) async throws -> [ScoredListing] {
        let site = NativeAuth.normalized(origin)
        let src = sources.isEmpty ? ["ebay", "mercari"] : sources
        do {
            let rows = try await scanOnDevice(query, keys: keys, sources: src)
            if !rows.isEmpty { return rows }
        } catch {
            // Phone could not reach eBay/Mercari. Fall back to the website's
            // free-desk book rather than showing nothing.
        }
        return try await scanViaSite(site, query, sources: src)
    }

    private static func scanViaSite(_ origin: String, _ query: String, sources: [String]) async throws -> [ScoredListing] {
        guard let url = URL(string: "\(origin)/api/native/scan") else {
            throw NSError(domain: "DealDex", code: 0, userInfo: [NSLocalizedDescriptionKey: "Website origin is not a valid URL."])
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("DealDex/1.0 (ios)", forHTTPHeaderField: "User-Agent")
        // No `keys` field. The endpoint refuses them and the privacy policy says
        // they never leave the phone; both halves have to stay true.
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "q": query,
            "sources": sources,
        ])
        let (data, res) = try await http.data(for: req)
        let code = (res as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if code >= 400 {
            throw NSError(domain: "DealDex", code: code, userInfo: [NSLocalizedDescriptionKey: json["error"] as? String ?? "Scan failed"])
        }
        let rows = json["rows"] as? [[String: Any]] ?? []
        return rows.compactMap(parseNativeRow)
    }

    private static func parseNativeRow(_ obj: [String: Any]) -> ScoredListing? {
        let id = obj["id"] as? String ?? ""
        let market = obj["marketplace"] as? String ?? ""
        let title = obj["title"] as? String ?? ""
        guard !id.isEmpty, !title.isEmpty else { return nil }
        let listing = LiveListing(
            id: id,
            marketplace: market,
            title: title,
            url: obj["url"] as? String ?? "",
            price: num(obj["price"]),
            shipping: num(obj["shipping"]) ?? 0,
            image: obj["image"] as? String
        )
        var card: TcgCard?
        if let c = obj["card"] as? [String: Any], let cid = c["id"] as? String {
            card = TcgCard(
                id: cid,
                name: c["name"] as? String ?? "",
                localId: c["localId"] as? String ?? "",
                setName: c["setName"] as? String ?? "",
                setId: c["setId"] as? String ?? "",
                rarity: c["rarity"] as? String,
                image: c["image"] as? String,
                finishes: [],
                cardmarketEur: nil
            )
        }
        var appraisal: Appraisal?
        if let a = obj["appraisal"] as? [String: Any] {
            appraisal = Appraisal(
                market: num(a["market"]),
                adjusted: num(a["adjusted"]),
                allIn: num(a["allIn"]) ?? 0,
                spread: num(a["spread"]),
                verdict: a["verdict"] as? String ?? "fair"
            )
        }
        return ScoredListing(listing: listing, card: card, appraisal: appraisal, grade: obj["grade"] as? String ?? "raw")
    }

    private static func num(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let n = v as? NSNumber { return n.doubleValue }
        return nil
    }

    private static func scanOnDevice(_ query: String, keys: DeskKeys, sources: [String]) async throws -> [ScoredListing] {
        let q = query.trimmingCharacters(in: .whitespaces)
        let ebayQ = Appraise.tokens(q).isEmpty ? "pokemon" : q
        let mercQ = Appraise.tokens(q).isEmpty ? "pokemon card" : "\(q) pokemon card"
        let wantEbay = sources.contains("ebay")
        let wantMerc = sources.contains("mercari")
        let ebayMd: String
        if wantEbay {
            do { ebayMd = try await get("\(jina)https://www.ebay.com/sch/183454/i.html?_nkw=\(enc(ebayQ))&LH_BIN=1&_ipg=60&_udlo=3&_sop=10") } catch { ebayMd = "" }
        } else { ebayMd = "" }
        let mercMd: String
        if wantMerc {
            do { mercMd = try await get("\(jina)https://www.mercari.com/search/?keyword=\(enc(mercQ))") } catch { mercMd = "" }
        } else { mercMd = "" }
        let listings = (wantEbay ? parseEbay(ebayMd, q) : []) + (wantMerc ? parseMercari(mercMd, q) : [])
        if listings.isEmpty && ebayMd.isEmpty && mercMd.isEmpty {
            throw NSError(domain: "DealDex", code: 0, userInfo: [NSLocalizedDescriptionKey: "Could not reach eBay or Mercari.  Try again in a minute."])
        }
        var cache: [String: [TcgCard]] = [:]
        var extraCache: [String: Double?] = [:]
        var scored: [ScoredListing] = []
        for listing in listings {
            let name = Appraise.nameQuery(listing.title)
            let grade = Appraise.detectGrade(listing.title)
            if cache[name] == nil { cache[name] = (try? await searchCards(name)) ?? [] }
            let card = pick(cache[name] ?? [], listing)
            var extra: Double? = nil
            if let card, keys.any {
                if extraCache[card.id] == nil { extraCache[card.id] = await PaidDesks.blend(card: card, keys: keys) }
                extra = extraCache[card.id] ?? nil
            }
            let appraisal = card.flatMap { listing.price == nil ? nil : Appraise.appraise(card: $0, listing: listing, grade: grade, extra: extra) }
            scored.append(ScoredListing(listing: listing, card: card, appraisal: appraisal, grade: grade))
        }
        return scored.sorted { ($0.appraisal?.spread ?? -99) > ($1.appraisal?.spread ?? -99) }
    }

    /// Pick the card a listing is actually for.
    ///
    /// This used to return whichever card's market price sat closest to the
    /// listing's own ask — so the ask chose the card, and the card then decided
    /// whether the ask was a deal. It also applied no name filter at all, so a
    /// listing could be bound to a different Pokemon entirely.
    private static func pick(_ cards: [TcgCard], _ listing: LiveListing) -> TcgCard? {
        guard !cards.isEmpty else { return nil }
        let name = Appraise.nameQuery(listing.title)
        guard let head = Appraise.tokens(name).first else { return nil }
        let named = cards.filter { $0.name.lowercased().contains(head) }
        guard !named.isEmpty else { return nil }
        let priced = named.filter { $0.finishes.contains(where: { $0.market != nil }) }
        let pool = priced.isEmpty ? named : priced
        // Deterministic and price-independent.
        return pool.min { $0.id < $1.id }
    }

    static func searchCards(_ name: String) async throws -> [TcgCard] {
        let raw = try await get("\(tcg)/cards?name=\(enc(name))&pagination:itemsPerPage=8", accept: "application/json")
        guard let data = raw.data(using: .utf8),
              let arr = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
        var out: [TcgCard] = []
        for item in arr.prefix(8) {
            if let id = item["id"] as? String, let card = try? await fetchCard(id) { out.append(card) }
        }
        return out
    }

    static func fetchCard(_ id: String) async throws -> TcgCard? {
        let raw = try await get("\(tcg)/cards/\(enc(id))", accept: "application/json")
        guard let data = raw.data(using: .utf8),
              let o = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let set = o["set"] as? [String: Any]
        let pricing = o["pricing"] as? [String: Any]
        let tcgplayer = pricing?["tcgplayer"] as? [String: Any]
        let cm = pricing?["cardmarket"] as? [String: Any]
        var finishes: [Finish] = []
        tcgplayer?.forEach { key, value in
            guard let block = value as? [String: Any] else { return }
            let market = block["marketPrice"] as? Double
            if market != nil || block["midPrice"] != nil {
                finishes.append(Finish(key: key, label: key, market: market))
            }
        }
        return TcgCard(
            id: o["id"] as? String ?? id,
            name: o["name"] as? String ?? "",
            localId: String(describing: o["localId"] ?? ""),
            setName: set?["name"] as? String ?? "Unknown set",
            setId: set?["id"] as? String ?? "",
            rarity: o["rarity"] as? String,
            image: o["image"] as? String,
            finishes: finishes,
            cardmarketEur: cm?["trend"] as? Double ?? cm?["avg"] as? Double
        )
    }

    private static func get(_ url: String, accept: String = "text/plain") async throws -> String {
        var req = URLRequest(url: URL(string: url)!)
        req.setValue("DealDex/1.0 (ios)", forHTTPHeaderField: "User-Agent")
        req.setValue(accept, forHTTPHeaderField: "Accept")
        let (data, _) = try await http.data(for: req)
        return String(data: data, encoding: .utf8) ?? ""
    }

    private static func enc(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? s
    }

    private static func firstPrice(_ text: String) -> Double? {
        if let m = text.range(of: #"(?:^|\n)\s*\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2}))"#, options: .regularExpression) {
            let slice = String(text[m]).replacingOccurrences(of: "$", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            if let n = parseMoneyLoose(slice), n >= 2.5 { return n }
        }
        let re = try! NSRegularExpression(pattern: #"\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})?)"#)
        let ns = text as NSString
        for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            if let n = parseMoneyLoose(ns.substring(with: m.range(at: 1))), n >= 2.5, n < 1_000_000 { return n }
        }
        return nil
    }

    private static func parseMoneyLoose(_ s: String) -> Double? {
        Double(s.replacingOccurrences(of: ",", with: ""))
    }

    /// First match of `pattern` in `text`, or nil. Lifts the listing thumbnail
    /// out of the Jina markdown. The on-device parsers dropped the image and
    /// emitted `nil`, so rows scanned on the phone rendered without a photo even
    /// though the same markdown carries one (the site parser has always read it).
    private static func firstMatch(_ text: String, _ pattern: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return nil }
        let ns = text as NSString
        guard let m = re.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return ns.substring(with: m.range)
    }

    private static func parseEbay(_ md: String, _ query: String) -> [LiveListing] {
        let re = try! NSRegularExpression(pattern: #"\[([^\]]{8,220})\]\(https://www\.ebay\.com/itm/(\d{12,14})[^)]*\)([\s\S]{0,700})"#)
        let ns = md as NSString
        var seen = Set<String>()
        var out: [LiveListing] = []
        for m in re.matches(in: md, range: NSRange(location: 0, length: ns.length)) {
            let id = ns.substring(with: m.range(at: 2))
            if !seen.insert(id).inserted { continue }
            var title = ns.substring(with: m.range(at: 1))
            title = title.replacingOccurrences(of: "Opens in a new window or tab", with: "", options: .caseInsensitive).trimmingCharacters(in: .whitespaces)
            if title.isEmpty || title.localizedCaseInsensitiveContains("shop on ebay") || Appraise.skipListing(title) { continue }
            if !Appraise.titleMatches(title, query) { continue }
            let chunk = ns.substring(with: m.range(at: 3))
            guard let price = firstPrice(chunk) else { continue }
            let image = firstMatch(chunk, #"https://i\.ebayimg\.com/images/g/[^)\s]+"#)
            out.append(LiveListing(id: id, marketplace: "ebay", title: title, url: "https://www.ebay.com/itm/\(id)", price: price, shipping: 4.47, image: image))
            if out.count >= 16 { break }
        }
        return out
    }

    private static func parseMercari(_ md: String, _ query: String) -> [LiveListing] {
        let re = try! NSRegularExpression(pattern: #"\[([\s\S]{8,500}?)\]\(https://www\.mercari\.com/us/item/(m\d+)/?[^)]*\)"#)
        let ns = md as NSString
        var seen = Set<String>()
        var out: [LiveListing] = []
        for m in re.matches(in: md, range: NSRange(location: 0, length: ns.length)) {
            let id = ns.substring(with: m.range(at: 2))
            if !seen.insert(id).inserted { continue }
            let inner = ns.substring(with: m.range(at: 1))
            let text = inner.replacingOccurrences(of: #"!\[[^\]]*]\([^)]+\)"#, with: " ", options: .regularExpression)
            let title = text.replacingOccurrences(of: #"\$[0-9,.]+\s*"#, with: " ", options: .regularExpression)
                .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
            if title.isEmpty || Appraise.skipListing(title) || !Appraise.titleMatches(title, query) { continue }
            // Mirror the Android parser: read the CDN thumbnail when the snippet
            // carries one, else fall back to Mercari's deterministic first-photo
            // URL so the row still shows a picture.
            let image = firstMatch(inner, #"https://u-mercari-images\.mercdn\.net/[^)\s]+"#)
                ?? "https://u-mercari-images.mercdn.net/photos/\(id)_1.jpg"
            out.append(LiveListing(id: id, marketplace: "mercari", title: title, url: "https://www.mercari.com/us/item/\(id)/", price: firstPrice(text), shipping: 4.49, image: image))
            if out.count >= 16 { break }
        }
        return out
    }
}
