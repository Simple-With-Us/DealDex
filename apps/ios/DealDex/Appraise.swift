import Foundation

enum Appraise {
    static let skip = try! NSRegularExpression(
        pattern: #"\b(lots?\b|\d+\s+cards\b|bulk|binder|choose your|etb|booster|proxy|custom\b|plush|hoodie)\b"#,
        options: .caseInsensitive
    )

    static func skipListing(_ title: String) -> Bool {
        let r = NSRange(title.startIndex..., in: title)
        return skip.firstMatch(in: title, range: r) != nil
    }

    static func parseMoney(_ raw: String?) -> Double? {
        guard let raw, let n = Double(raw.replacingOccurrences(of: ",", with: "")) , n > 0 else { return nil }
        return n
    }

    static func tokens(_ query: String) -> [String] {
        let generic: Set<String> = ["pokemon", "pokémon", "tcg", "card", "cards", "holo", "rare"]
        return query.lowercased()
            .replacingOccurrences(of: "[^a-z0-9\\s]", with: " ", options: .regularExpression)
            .split(separator: " ").map(String.init)
            .filter { $0.count > 2 && !generic.contains($0) }
    }

    static func titleMatches(_ title: String, _ query: String) -> Bool {
        guard let t = tokens(query).first else { return true }
        return title.lowercased().contains(t)
    }

    /// Grades the desks price differently. Kept in step with `GRADES` and
    /// `detectGrade` in `src/lib/tcg/parse-listing.ts` so the phone and the
    /// website reach the same verdict on the same listing.
    static func detectGrade(_ text: String) -> String {
        let t = text.uppercased().replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let checks: [(String, String)] = [
            (#"\bPSA ?10\b"#, "PSA 10"),
            (#"\bPSA ?9\b"#, "PSA 9"),
            (#"\bPSA ?8\b"#, "PSA 8"),
            (#"\bBGS ?10\b"#, "BGS 10"),
            (#"\bBGS ?9\.5\b"#, "BGS 9.5"),
            (#"\bCGC ?10\b"#, "CGC 10"),
            (#"\bCGC ?9\.5\b"#, "CGC 9.5"),
            (#"\bACE ?10\b"#, "ACE 10"),
        ]
        for (pattern, grade) in checks where t.range(of: pattern, options: .regularExpression) != nil {
            return grade
        }
        return "raw"
    }

    /// A standalone `HP` in a Pokemon listing title is the hit-point stat, not
    /// Heavily Played. `t.contains("hp")` matched a large share of every scan
    /// and cut the book to 35%, so the app called real deals overpriced. It also
    /// matched `lp` inside "Delphox" and `mp` inside "champion".
    /// `HP` is the only condition code that collides with card text — it is also
    /// the hit-point stat.  `LP`, `MP` and `DMG` never are, so the digit guard
    /// applies to `hp` alone.  Applying it to all four swallowed the code in
    /// `Charizard Base Set 4/102 LP`, which came back Near Mint.
    static let digitAmbiguous: Set<String> = ["hp"]

    static func hasConditionCode(_ text: String, _ code: String) -> Bool {
        // Bracketed, slash-joined or explicitly labelled: never a stat line.
        let explicit = "(\\(|\\[|/|\\bcond(ition)?\\b[ :-]*)\\s*\(code)\\b"
        if text.range(of: explicit, options: [.regularExpression, .caseInsensitive]) != nil { return true }
        // Otherwise it must be a standalone token.
        let standalone = "(^|[^a-z0-9])\(code)([^a-z0-9]|$)"
        let ns = text as NSString
        guard let re = try? NSRegularExpression(pattern: standalone, options: [.caseInsensitive]) else { return false }
        let guardDigits = digitAmbiguous.contains(code)
        for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            if guardDigits {
                let before = ns.substring(to: m.range.location)
                let after = ns.substring(from: min(m.range.location + m.range.length, ns.length))
                if before.range(of: #"\d\s*\W?\s*$"#, options: .regularExpression) != nil { continue }
                if after.range(of: #"^\W?\s*\d"#, options: .regularExpression) != nil { continue }
            }
            return true
        }
        return false
    }

    static func conditionMult(_ text: String) -> Double {
        let t = text.lowercased()
        // Spelled out is unambiguous and wins — but word-bound it.  A bare
        // `contains("damaged")` also matches "UNDAMAGED", which is a common
        // seller word and would have applied the 0.2x haircut to a clean card.
        func has(_ pattern: String) -> Bool {
            t.range(of: "\\b\(pattern)\\b", options: [.regularExpression]) != nil
        }
        if has("damaged") || has("poor condition") { return 0.2 }
        if has("heavily played") || has("heavy play") { return 0.35 }
        if has("moderately played") || has("moderate play") { return 0.55 }
        if has("lightly played") || has("light play") { return 0.8 }
        if has("near mint") || has("mint condition") { return 1 }

        if hasConditionCode(t, "dmg") { return 0.2 }
        if hasConditionCode(t, "hp") { return 0.35 }
        if hasConditionCode(t, "mp") { return 0.55 }
        if hasConditionCode(t, "lp") { return 0.8 }
        return 1
    }

    /// Mirrors `GRADE_MULT` / `PSA10_BY_BUCKET` in `src/lib/tcg/appraise.ts`.
    /// The old version returned a flat 1.35 for every non-10 grade and ignored
    /// the chase bucket entirely, so a PSA 8 and a BGS 9.5 priced identically.
    static let gradeMultBase: [String: Double] = [
        "PSA 10": 2.8, "PSA 9": 1.35, "PSA 8": 0.95,
        "BGS 10": 3.2, "BGS 9.5": 1.8,
        "CGC 10": 2.4, "CGC 9.5": 1.4,
        "ACE 10": 2.2,
    ]

    static func gradeMult(card: TcgCard?, grade: String) -> Double {
        if grade == "raw" { return 1 }
        let base = gradeMultBase[grade] ?? 1
        // The bucket scales this card's WHOLE grade curve, anchored on PSA 10.
        // Scaling only the 10s inverted the ordering on modern cards: PSA 10
        // came back 1.25 while PSA 9 kept its flat 1.35.
        guard let card else { return base }
        let set = "\(card.setId) \(card.setName)".lowercased()
        let rarity = (card.rarity ?? "").lowercased()
        let vintage = set.range(
            of: "base1|base2|base3|base4|jungle|fossil|neo|gym|team rocket|wotc",
            options: .regularExpression
        ) != nil
        let chase = rarity.range(
            of: "illustration rare|special illustration|alt art|hyper rare|secret",
            options: .regularExpression
        ) != nil
        let bucket: Double
        if vintage && rarity.contains("holo") { bucket = 8 }
        else if vintage { bucket = 4 }
        else if chase { bucket = 2.1 }
        else { bucket = 1.25 }
        return base * (bucket / 2.8)
    }

    static func nameQuery(_ title: String) -> String {
        let stop: Set<String> = ["pokemon", "pokémon", "tcg", "card", "cards", "holo", "rare", "nm", "psa", "bgs", "cgc", "english"]
        let cleaned = title.lowercased()
            .replacingOccurrences(of: #"https?://\S+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\$[0-9,.]+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9'\s-]"#, with: " ", options: .regularExpression)
        let parts = cleaned.split(separator: " ").map(String.init)
            .filter { !$0.isEmpty && !stop.contains($0) && Int($0) == nil }
        return parts.prefix(4).joined(separator: " ").isEmpty ? "pokemon" : parts.prefix(4).joined(separator: " ")
    }

    static func appraise(card: TcgCard, listing: LiveListing, grade: String, extra: Double? = nil) -> Appraisal {
        let seed = [card.finishes.first(where: { $0.market != nil })?.market, extra].compactMap { $0 }
        let raw = seed.isEmpty ? nil : seed.reduce(0, +) / Double(seed.count)
        let adjusted = raw.map { $0 * conditionMult(listing.title) * gradeMult(card: card, grade: grade) }
        let allIn = (listing.price ?? 0) + listing.shipping
        let spread = (adjusted != nil && adjusted! > 0) ? (adjusted! - allIn) / adjusted! : nil
        let verdict: String
        switch spread {
        case .some(let s) where s >= 0.30: verdict = "steal"
        case .some(let s) where s >= 0.12: verdict = "good"
        case .some(let s) where s >= -0.08: verdict = "fair"
        case .some(let s) where s >= -0.30: verdict = "high"
        case .some: verdict = "avoid"
        default: verdict = "fair"
        }
        return Appraisal(market: raw, adjusted: adjusted, allIn: allIn, spread: spread, verdict: verdict)
    }
}
