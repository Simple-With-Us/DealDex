import Foundation

struct LiveListing: Identifiable, Hashable {
    var id: String
    var marketplace: String
    var title: String
    var url: String
    var price: Double?
    var shipping: Double
    var image: String?
    var compositeId: String { marketplace + id }
}

struct Finish: Hashable {
    var key: String
    var label: String
    var market: Double?
}

struct TcgCard: Hashable {
    var id: String
    var name: String
    var localId: String
    var setName: String
    var setId: String
    var rarity: String?
    var image: String?
    var finishes: [Finish]
    var cardmarketEur: Double?
}

struct Appraisal: Hashable {
    var market: Double?
    var adjusted: Double?
    var allIn: Double
    var spread: Double?
    var verdict: String
}

struct ScoredListing: Identifiable, Hashable {
    var id: String { listing.compositeId }
    var listing: LiveListing
    var card: TcgCard?
    var appraisal: Appraisal?
    var grade: String
}

/// Auto-buy config for a saved filter.  Mirrors src/lib/alerts/types.ts
/// `AutoBuyConfig`.  Cents for caps (matches the eBay Order API).
struct AutoBuyConfig: Codable, Hashable {
    var enabled: Bool = false
    var dryRun: Bool = true
    var maxPriceCents: Int = 5000
    var minSpread: Double = 0.18
    var maxMonthlyCents: Int = 50000
    var maxDailyCents: Int = 10000
    var coolHours: Int = 24
    var marketplace: String = "ebay"
}

/// Out-of-app channel toggles + credentials.  Mirrors the web channels
/// map in src/lib/alerts/types.ts.  Email / SMS / Pushover providers are
/// gated server-side; the runner picks these up once the providers are
/// wired.
struct AlertChannels: Codable, Hashable {
    var emailToggle: Bool = false
    var email: String = ""
    var smsToggle: Bool = false
    var phone: String = ""
    var pushoverToggle: Bool = false
    var pushoverUser: String = ""
    var pushoverToken: String = ""
}

struct AlertRule: Identifiable, Hashable {
    var id: String
    var name: String
    var enabled: Bool = true
    var keyword: String = ""
    var minSpread: Double? = 0.12
    var maxPrice: Double? = 100
    var autoBuy: AutoBuyConfig = AutoBuyConfig()
    var channels: AlertChannels = AlertChannels()
}

struct SavedAppraisal: Identifiable, Codable, Hashable {
    var id: String = UUID().uuidString
    var cardId: String
    var cardName: String
    var setName: String
    var localId: String
    var marketplace: String
    var listingTitle: String
    var listingPrice: Double
    var marketPrice: Double?
    var spread: Double?
    var verdict: String
    var condition: String
    var grade: String
    var status: String = "watching" // "watching", "bought", "passed"
    var createdAt: Date = Date()
}

