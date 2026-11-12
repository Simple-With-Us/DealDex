import Foundation
import UserNotifications

@MainActor
final class DeskModel: ObservableObject {
    @Published var query = ""
    @Published var loading = false
    @Published var rows: [ScoredListing] = []
    @Published var error: String?
    @Published var view = "all"
    @Published var sources: Set<String> = ["ebay", "mercari"]
    @Published var rule = AlertRule(id: "default", name: "Steals under $100")
    @Published var verdictFilter = "any"
    @Published var priceCap = "any"
    @Published var condition = "any"
    @Published var spreadMin = "any"
    @Published var finish = "any"
    @Published var hideProxies = true

    @Published var justTcg = DeskStore.keys.justTcg
    @Published var priceCharting = DeskStore.keys.priceCharting
    @Published var pokemonTcg = DeskStore.keys.pokemonTcg
    @Published var settingsNote: String?

    var origin: String { DeskStore.defaultOrigin }
    @Published var loginEmail = DeskStore.email
    @Published var loginPassword = ""
    @Published var accountEmail = DeskStore.signedIn ? DeskStore.email : ""
    @Published var accountBusy = false
    @Published var accountNote: String?

    init() { Task { await scan("", notify: false) } }

    var keys: DeskKeys {
        DeskKeys(justTcg: justTcg, priceCharting: priceCharting, pokemonTcg: pokemonTcg)
    }

    var visible: [ScoredListing] {
        rows.filter { row in
            if hideProxies {
                let t = row.listing.title.lowercased()
                if t.contains("proxy") || t.contains("repack") || t.contains("replica") { return false }
            }
            switch view {
            case "ebay":
                if row.listing.marketplace != "ebay" { return false }
            case "mercari":
                if row.listing.marketplace != "mercari" { return false }
            case "deals":
                if row.appraisal?.verdict != "steal" && row.appraisal?.verdict != "good" { return false }
            case "verified":
                let v = row.appraisal?.verdict
                if row.card == nil || (v != "steal" && v != "good") { return false }
            default:
                break
            }
            if verdictFilter != "any" && row.appraisal?.verdict != verdictFilter { return false }
            if priceCap != "any", let cap = Double(priceCap) {
                guard let price = row.listing.price, price <= cap else { return false }
            }
            if condition == "raw" && row.grade != "raw" { return false }
            if condition == "graded" && row.grade == "raw" { return false }
            if spreadMin != "any", let min = Double(spreadMin) {
                guard let spread = row.appraisal?.spread, spread >= min / 100 else { return false }
            }
            if finish != "any" {
                let blob = row.listing.title.lowercased()
                if !blob.contains(finish) { return false }
            }
            return true
        }
    }

    var ebayCount: Int { rows.filter { $0.listing.marketplace == "ebay" }.count }
    var mercariCount: Int { rows.filter { $0.listing.marketplace == "mercari" }.count }
    var dealCount: Int {
        rows.filter { $0.appraisal?.verdict == "steal" || $0.appraisal?.verdict == "good" }.count
    }
    var verifiedCount: Int {
        rows.filter {
            ($0.appraisal?.verdict == "steal" || $0.appraisal?.verdict == "good") && $0.card != nil
        }.count
    }

    func toggleSource(_ market: String) {
        if sources.contains(market) {
            if sources.count > 1 { sources.remove(market) }
        } else {
            sources.insert(market)
        }
    }

    func saveKeys() {
        DeskStore.keys = keys
        settingsNote = "Saved on this iPhone. Scan uses them even if the website is down."
    }

    func scan(_ q: String? = nil, notify: Bool = false) async {
        if let q { query = q }
        loading = true
        error = nil
        do {
            let found = try await Market.scan(query, keys: keys, origin: origin, sources: Array(sources))
            rows = found
            if notify { await fireAlerts(found) }
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    func signInSocial(_ provider: String) async {
        accountBusy = true
        accountNote = nil
        do {
            // Apple: use the native ASAuthorizationAppleIDProvider sheet — no web browser,
            // no "Finish signing in" tap, no form_post redirect issues.
            // Google / X: use the existing ASWebAuthenticationSession flow.
            let session: AccountApi.Session
            if provider == "apple" {
                session = try await NativeAuth.signInApple(origin: DeskStore.defaultOrigin)
            } else {
                session = try await NativeAuth.signIn(origin: DeskStore.defaultOrigin, provider: provider)
            }
            DeskStore.token = session.token
            DeskStore.email = session.email
            let label = provider == "twitter" ? "X" : provider.capitalized
            accountEmail = session.email.isEmpty ? label : session.email
            accountNote = "Signed in with \(label).  Keys still live on this phone.  Pull or push to sync."
        } catch {
            let desc = error.localizedDescription
            if desc.contains("cancelled") || desc.contains("canceled") {
                accountNote = nil
            } else {
                accountNote = desc + "  Scan still works without signing in."
            }
        }
        accountBusy = false
    }

    func signInGoogle() async {
        await signInSocial("google")
    }

    func pullKeys() async {
        guard DeskStore.signedIn else { accountNote = "Sign in first."; return }
        accountBusy = true
        accountNote = nil
        do {
            let remote = try await AccountApi.pullKeys(origin: DeskStore.origin, token: DeskStore.token)
            if !remote.justTcg.isEmpty { justTcg = remote.justTcg }
            if !remote.priceCharting.isEmpty { priceCharting = remote.priceCharting }
            if !remote.pokemonTcg.isEmpty { pokemonTcg = remote.pokemonTcg }
            DeskStore.keys = keys
            accountNote = "Pulled onto this iPhone. Scan will use them if the site goes down."
        } catch {
            accountNote = error.localizedDescription + " — using keys already on this phone."
        }
        accountBusy = false
    }

    func pushKeys() async {
        guard DeskStore.signedIn else { accountNote = "Sign in first."; return }
        DeskStore.keys = keys
        accountBusy = true
        accountNote = nil
        do {
            try await AccountApi.pushKeys(origin: DeskStore.origin, token: DeskStore.token, keys: keys)
            accountNote = "Phone keys copied to your account."
        } catch {
            accountNote = error.localizedDescription + " — keys stay on this phone."
        }
        accountBusy = false
    }

    func signOut() {
        DeskStore.token = ""
        accountEmail = ""
        accountNote = "Signed out. Saved keys stay on this phone."
    }

    private func fireAlerts(_ rows: [ScoredListing]) async {
        guard rule.enabled else { return }
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else { return }
        for row in rows {
            guard let a = row.appraisal else { continue }
            if let max = rule.maxPrice, (row.listing.price ?? .greatestFiniteMagnitude) > max { continue }
            if let min = rule.minSpread, (a.spread ?? -1) < min { continue }
            if !rule.keyword.isEmpty && !row.listing.title.localizedCaseInsensitiveContains(rule.keyword) { continue }
            if a.verdict != "steal" && a.verdict != "good" { continue }
            let content = UNMutableNotificationContent()
            content.title = rule.name
            content.body = "\(row.listing.title) · $\(row.listing.price ?? 0)"
            let req = UNNotificationRequest(identifier: row.id, content: content, trigger: nil)
            try? await UNUserNotificationCenter.current().add(req)
        }
    }
}
