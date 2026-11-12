import SwiftUI

struct EvaluatorView: View {
    var initialCard: TcgCard? = nil
    @StateObject private var savedStore = SavedStore()
    @State private var query: String = ""
    @State private var searching: Bool = false
    @State private var searchResults: [TcgCard] = []
    @State private var activeCard: TcgCard?
    @State private var askPrice: String = ""
    @State private var shipping: String = "4.50"
    @State private var condition: String = "NM"
    @State private var grade: String = "raw"
    @State private var finish: String = ""
    @State private var marketplace: String = "ebay"
    @State private var isSaved: Bool = false

    private let conditions = ["NM", "LP", "MP", "HP", "DMG"]
    private let grades = ["raw", "PSA 10", "PSA 9", "PSA 8", "BGS 10", "CGC 10", "ACE 10"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Search / Paste Section
                    VStack(alignment: .leading, spacing: 8) {
                        Text("CARD OR LISTING SEARCH")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.secondary)

                        HStack {
                            TextField("Search card name (e.g. Charizard 151)", text: $query)
                                .textFieldStyle(.roundedBorder)
                            Button("Search") {
                                Task { await searchCards() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.25, green: 0.29, blue: 0.20))
                        }
                    }
                    .padding()
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))

                    if searching {
                        HStack {
                            Spacer()
                            ProgressView("Searching catalog…")
                            Spacer()
                        }
                        .padding()
                    } else if !searchResults.isEmpty && activeCard == nil {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("SELECT MATCHING CARD")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                            ForEach(searchResults, id: \.id) { c in
                                Button {
                                    activeCard = c
                                    finish = c.finishes.first?.key ?? ""
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(c.name).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                                            Text("\(c.setName) #\(c.localId)").font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if let m = c.finishes.first?.market {
                                            Text(String(format: "$%.2f", m)).font(.caption.monospaced()).foregroundStyle(.primary)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                                Divider()
                            }
                        }
                        .padding()
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                    }

                    if let card = activeCard {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(card.name).font(.title3.weight(.bold))
                                    Text("\(card.setName) #\(card.localId)").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Change") {
                                    activeCard = nil
                                }
                                .font(.caption)
                            }

                            Divider()

                            // Parameters Grid
                            VStack(spacing: 12) {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Ask Price ($)").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                                        TextField("0.00", text: $askPrice)
                                            .keyboardType(.decimalPad)
                                            .textFieldStyle(.roundedBorder)
                                    }
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Shipping ($)").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                                        TextField("4.50", text: $shipping)
                                            .keyboardType(.decimalPad)
                                            .textFieldStyle(.roundedBorder)
                                    }
                                }

                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Condition").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                                        Picker("Condition", selection: $condition) {
                                            ForEach(conditions, id: \.self) { Text($0) }
                                        }
                                        .pickerStyle(.menu)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 4)
                                        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
                                    }
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Grade").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                                        Picker("Grade", selection: $grade) {
                                            ForEach(grades, id: \.self) { Text($0) }
                                        }
                                        .pickerStyle(.menu)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 4)
                                        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
                                    }
                                }
                            }

                            // Appraisal Calculation Card
                            if let ask = Double(askPrice) {
                                let ship = Double(shipping) ?? 0.0
                                let allIn = ask + ship
                                let baseMarket = activeFinishPrice(card)
                                let mult = conditionMult(condition) * gradeMult(card, grade)
                                let adjustedBook = baseMarket.map { $0 * mult }

                                if let book = adjustedBook {
                                    let dollarsOff = book - allIn
                                    let spread = book > 0 ? dollarsOff / book : 0.0
                                    let verdict = calcVerdict(spread)
                                    let flipNet = (book * (1.0 - 0.1125)) - allIn

                                    VStack(alignment: .leading, spacing: 10) {
                                        HStack {
                                            Text("APPRAISAL VERDICT")
                                                .font(.caption2.weight(.bold))
                                                .foregroundStyle(.secondary)
                                            Spacer()
                                            Text(verdict.uppercased())
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(verdictColor(verdict))
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 3)
                                                .background(RoundedRectangle(cornerRadius: 6).fill(verdictColor(verdict).opacity(0.15)))
                                        }

                                        HStack(spacing: 16) {
                                            VStack(alignment: .leading) {
                                                Text("This Ask (All-in)").font(.caption2).foregroundStyle(.secondary)
                                                Text(String(format: "$%.2f", allIn)).font(.headline.monospaced())
                                            }
                                            VStack(alignment: .leading) {
                                                Text("Book Middle").font(.caption2).foregroundStyle(.secondary)
                                                Text(String(format: "$%.2f", book)).font(.headline.monospaced())
                                            }
                                            VStack(alignment: .leading) {
                                                Text("Spread").font(.caption2).foregroundStyle(.secondary)
                                                Text(String(format: "%+.1f%%", spread * 100))
                                                    .font(.headline.monospaced())
                                                    .foregroundStyle(verdictColor(verdict))
                                            }
                                        }

                                        Divider()

                                        HStack {
                                            Text("Net Flip (after ~11.2% fees):")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                            Spacer()
                                            Text(String(format: "%+$%.2f", flipNet))
                                                .font(.subheadline.monospaced().weight(.bold))
                                                .foregroundStyle(flipNet > 0 ? Color(red: 0.25, green: 0.35, blue: 0.22) : .secondary)
                                        }

                                        // PSA Grading Arbitrage Box (if raw NM)
                                        if grade == "raw" && condition == "NM", let rawBook = baseMarket {
                                            let psa10Value = rawBook * Appraise.gradeMult(card: card, grade: "PSA 10")
                                            let psa10Net = (psa10Value * (1.0 - 0.1125)) - (allIn + 22.0)
                                            if psa10Net > 20 {
                                                VStack(alignment: .leading, spacing: 4) {
                                                    HStack {
                                                        Image(systemName: "sparkles").foregroundStyle(.orange)
                                                        Text("Grading Upside: PSA 10 Est. $\(Int(psa10Value))")
                                                            .font(.caption2.weight(.bold))
                                                    }
                                                    Text(String(format: "Net profit after $22 grading fee: +$%.2f", psa10Net))
                                                        .font(.caption2)
                                                        .foregroundStyle(.secondary)
                                                }
                                                .padding(8)
                                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.orange.opacity(0.1)))
                                            }
                                        }

                                        // Action buttons
                                        HStack(spacing: 12) {
                                            Button {
                                                saveToLedger(card: card, ask: ask, book: book, spread: spread, verdict: verdict)
                                            } label: {
                                                HStack {
                                                    Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                                                    Text(isSaved ? "Saved" : "Save to Ledger")
                                                }
                                                .font(.subheadline.weight(.semibold))
                                                .frame(maxWidth: .infinity)
                                            }
                                            .buttonStyle(.borderedProminent)
                                            .tint(isSaved ? Color(red: 0.25, green: 0.45, blue: 0.25) : Color(red: 0.25, green: 0.29, blue: 0.20))

                                            Button {
                                                shareDeal(card: card, allIn: allIn, book: book, spread: spread, verdict: verdict, flipNet: flipNet)
                                            } label: {
                                                Image(systemName: "square.and.arrow.up")
                                            }
                                            .buttonStyle(.bordered)
                                        }
                                        .padding(.top, 6)
                                    }
                                    .padding()
                                    .background(RoundedRectangle(cornerRadius: 10).fill(Color(red: 0.96, green: 0.96, blue: 0.94)))
                                }
                            }
                        }
                        .padding()
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                    }
                }
                .padding()
            }
            .background(Color(red: 0.95, green: 0.94, blue: 0.90))
            .navigationTitle("Evaluator")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                if let c = initialCard {
                    activeCard = c
                    query = c.name
                    finish = c.finishes.first?.key ?? ""
                }
            }
        }
    }

    private func activeFinishPrice(_ card: TcgCard) -> Double? {
        if !finish.isEmpty, let match = card.finishes.first(where: { $0.key == finish }) {
            return match.market
        }
        return card.finishes.first?.market
    }

    private func conditionMult(_ c: String) -> Double {
        switch c {
        case "NM": return 1.0
        case "LP": return 0.8
        case "MP": return 0.55
        case "HP": return 0.35
        case "DMG": return 0.2
        default: return 1.0
        }
    }

    private func gradeMult(_ card: TcgCard, _ g: String) -> Double {
        return Appraise.gradeMult(card: card, grade: g)
    }

    private func calcVerdict(_ s: Double) -> String {
        if s >= 0.30 { return "steal" }
        if s >= 0.12 { return "good" }
        if s >= -0.08 { return "fair" }
        if s >= -0.30 { return "high" }
        return "avoid"
    }

    private func verdictColor(_ v: String) -> Color {
        switch v {
        case "steal", "good": return Color(red: 0.25, green: 0.35, blue: 0.22)
        case "high", "avoid": return Color(red: 0.56, green: 0.31, blue: 0.27)
        default: return Color(red: 0.48, green: 0.40, blue: 0.22)
        }
    }

    private func searchCards() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        searching = true
        activeCard = nil
        do {
            searchResults = try await Market.searchCards(q)
            if let first = searchResults.first {
                activeCard = first
                finish = first.finishes.first?.key ?? ""
            }
        } catch {
            searchResults = []
        }
        searching = false
    }

    private func saveToLedger(card: TcgCard, ask: Double, book: Double, spread: Double, verdict: String) {
        let item = SavedAppraisal(
            cardId: card.id,
            cardName: card.name,
            setName: card.setName,
            localId: card.localId,
            marketplace: marketplace,
            listingTitle: "\(card.name) \(card.setName)",
            listingPrice: ask,
            marketPrice: book,
            spread: spread,
            verdict: verdict,
            condition: condition,
            grade: grade,
            status: "watching",
            createdAt: Date()
        )
        savedStore.save(item: item)
        isSaved = true
    }

    private func shareDeal(card: TcgCard, allIn: Double, book: Double, spread: Double, verdict: String, flipNet: Double) {
        let text = "🔥 DealDex: \(card.name) (\(card.setName) #\(card.localId)) · Ask: $\(String(format: "%.2f", allIn)) · Book: $\(String(format: "%.2f", book)) (\(String(format: "%+.1f%%", spread * 100))) · Verdict: \(verdict.capitalized) · Net Flip: $\(String(format: "%.2f", flipNet)) · https://dealdex.net/card/\(card.id)"
        UIPasteboard.general.string = text
    }
}
