import AVFoundation
import SwiftUI
import VisionKit

struct ScanView: View {
    @EnvironmentObject var desk: DeskModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var showScanner = false

    private var twoUp: Bool { sizeClass == .regular }
    private var columns: [GridItem] {
        if twoUp {
            [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        } else {
            [GridItem(.flexible())]
        }
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                DealDexTitle(height: 38)
                Text(DealDexCopy.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    TextField("Card, set, or leave blank", text: $desk.query)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        showScanner = true
                    } label: {
                        Image(systemName: "camera.viewfinder")
                            .font(.title3)
                            .frame(width: 40, height: 30)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color(red: 0.25, green: 0.29, blue: 0.20))
                    .accessibilityLabel("Read a card with the camera")
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    filterMenu("Verdict", selection: $desk.verdictFilter, options: [
                        ("any", "Any Verdict"),
                        ("steal", "Steal"),
                        ("good", "Good Deal"),
                        ("fair", "Fair"),
                        ("high", "High Ask"),
                        ("avoid", "Overpriced"),
                    ])
                    filterMenu("Max Ask", selection: $desk.priceCap, options: [
                        ("any", "Any Price"),
                        ("25", "Under $25"),
                        ("50", "Under $50"),
                        ("100", "Under $100"),
                        ("250", "Under $250"),
                    ])
                    filterMenu("Condition", selection: $desk.condition, options: [
                        ("any", "Raw or Graded"),
                        ("raw", "Raw Only"),
                        ("graded", "Graded Only"),
                    ])
                    filterMenu("Min Discount", selection: $desk.spreadMin, options: [
                        ("any", "Any vs Book"),
                        ("10", "10%+ Under Book"),
                        ("20", "20%+ Under Book"),
                        ("40", "40%+ Under Book"),
                    ])
                    filterMenu("Finish", selection: $desk.finish, options: [
                        ("any", "Any Finish"),
                        ("holo", "Holo"),
                        ("reverse", "Reverse"),
                        ("promo", "Promo"),
                    ])
                    VStack(spacing: 2) {
                        Color.clear.frame(height: 14)
                        Button {
                            desk.hideProxies.toggle()
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: desk.hideProxies ? "checkmark.square.fill" : "square")
                                Text("Hide Proxies")
                                    .lineLimit(1)
                            }
                            .font(.subheadline)
                            .foregroundStyle(Color(red: 0.10, green: 0.11, blue: 0.09))
                            .frame(maxWidth: .infinity, minHeight: 36)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Button {
                    Task { await desk.scan(notify: false) }
                } label: {
                    Group {
                        if desk.loading {
                            ProgressView()
                                .tint(Color(red: 0.96, green: 0.95, blue: 0.92))
                        } else {
                            Text("SCAN")
                                .font(.system(size: 34, weight: .semibold, design: .default))
                                .tracking(1.6)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .foregroundStyle(Color(red: 0.96, green: 0.95, blue: 0.92))
                    .background(Color(red: 0.29, green: 0.20, blue: 0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(desk.loading)
                .buttonStyle(.plain)
                HStack(spacing: 8) {
                    MarketplaceToggle(
                        market: "ebay",
                        selected: desk.sources.contains("ebay"),
                        count: desk.ebayCount,
                        large: true
                    ) {
                        desk.toggleSource("ebay")
                        Task { await desk.scan(notify: false) }
                    }
                    MarketplaceToggle(
                        market: "mercari",
                        selected: desk.sources.contains("mercari"),
                        count: desk.mercariCount,
                        large: true
                    ) {
                        desk.toggleSource("mercari")
                        Task { await desk.scan(notify: false) }
                    }
                }
                HStack(spacing: 8) {
                    chip("all", "All \(desk.rows.count)")
                    chip("deals", "Deals \(desk.dealCount)")
                    chip("verified", "Verified \(desk.verifiedCount)")
                }
                if desk.loading && desk.rows.isEmpty {
                    // Leading parent VStack: expand and center in the remaining results area.
                    ProgressView("Reading eBay and Mercari…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                } else if let err = desk.error {
                    Text(err).foregroundStyle(.red)
                    Spacer()
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(desk.visible) { row in
                                ListingRow(row: row)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                            }
                        }
                    }
                }
            }
            .padding()
            .background(Color(red: 0.95, green: 0.94, blue: 0.90))
            .sheet(isPresented: $showScanner) {
                CardScannerView { query in
                    desk.query = query
                }
            }
        }
    }

    private func chip(_ key: String, _ label: String) -> some View {
        Button(label) { desk.view = key }
            .buttonStyle(.bordered)
            .tint(desk.view == key ? Color(red: 0.25, green: 0.29, blue: 0.20) : .secondary)
    }

    private func filterMenu(_ title: String, selection: Binding<String>, options: [(String, String)]) -> some View {
        let current = options.first(where: { $0.0 == selection.wrappedValue })?.1 ?? options.first?.1 ?? title
        return VStack(spacing: 2) {
            Text(title.uppercased())
                .font(.caption2.weight(.medium))
                .tracking(1.0)
                .foregroundStyle(Color(red: 0.23, green: 0.22, blue: 0.20))
                .frame(maxWidth: .infinity)
            Menu {
                ForEach(options, id: \.0) { key, name in
                    Button(name) { selection.wrappedValue = key }
                }
            } label: {
                Text(current)
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.10, green: 0.11, blue: 0.09))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .padding(.horizontal, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color(red: 0.56, green: 0.54, blue: 0.49), lineWidth: 1)
                    )
            }
        }
    }
}

struct ListingRow: View {
    let row: ScoredListing
    @StateObject private var savedStore = SavedStore()
    @State private var isSaved: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let img = row.listing.image ?? row.card?.image, let url = URL(string: img) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(white: 0.9))
                    }
                }
                .frame(width: 54, height: 75)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    MarketplaceMark(market: row.listing.marketplace)
                    if let v = row.appraisal?.verdict {
                        Text(v.uppercased())
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(color(v))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(RoundedRectangle(cornerRadius: 4).fill(color(v).opacity(0.12)))
                    }
                    Spacer()
                    Button {
                        toggleSave()
                    } label: {
                        Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                            .font(.caption)
                            .foregroundStyle(isSaved ? Color(red: 0.25, green: 0.45, blue: 0.25) : .secondary)
                    }
                    .buttonStyle(.plain)
                }

                Text(row.listing.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)

                if let card = row.card {
                    Text("\(card.name) · \(card.setName) #\(card.localId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 12) {
                    Text(money(row.listing.price) + " ask")
                        .font(.system(.caption, design: .monospaced))
                    Text(money(row.appraisal?.adjusted) + " TCGP")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                    if let s = row.appraisal?.spread {
                        Text(String(format: "%+.1f%%", s * 100))
                            .font(.system(.caption, design: .monospaced).weight(.semibold))
                            .foregroundStyle(color(row.appraisal?.verdict ?? "fair"))
                    }
                }

                HStack(spacing: 12) {
                    if let card = row.card {
                        NavigationLink {
                            CardDossierView(card: card)
                        } label: {
                            Text("Card Dossier")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color(red: 0.25, green: 0.29, blue: 0.20))
                        }
                    }

                    if let url = URL(string: row.listing.url) {
                        Link(destination: url) {
                            HStack(spacing: 2) {
                                Text("Open Listing")
                                Image(systemName: "arrow.up.right")
                            }
                            .font(.caption)
                        }
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 2)
    }

    private func toggleSave() {
        guard let card = row.card, let ask = row.listing.price else { return }
        let item = SavedAppraisal(
            cardId: card.id,
            cardName: card.name,
            setName: card.setName,
            localId: card.localId,
            marketplace: row.listing.marketplace,
            listingTitle: row.listing.title,
            listingPrice: ask,
            marketPrice: row.appraisal?.adjusted,
            spread: row.appraisal?.spread,
            verdict: row.appraisal?.verdict ?? "fair",
            condition: "NM",
            grade: row.grade,
            status: "watching",
            createdAt: Date()
        )
        savedStore.save(item: item)
        isSaved = true
    }

    private func money(_ n: Double?) -> String {
        guard let n else { return "—" }
        return String(format: "$%.2f", n)
    }

    private func color(_ v: String) -> Color {
        switch v {
        case "steal", "good": return Color(red: 0.25, green: 0.35, blue: 0.22)
        case "high", "avoid": return Color(red: 0.56, green: 0.31, blue: 0.27)
        default: return Color(red: 0.48, green: 0.40, blue: 0.22)
        }
    }
}


// MARK: - Card scanner
//
// This lives in ScanView.swift rather than its own file on purpose.  The Xcode
// project is a classic group-based .pbxproj generated by XcodeGen, so a new
// .swift file only reaches the target after `xcodegen generate` runs on a Mac —
// and hand-editing project.pbxproj is forbidden (apps/ios/CLAUDE.md).  Split
// this out the moment someone regenerates the project.

/// One line of text the camera actually read.
///
/// `height` is the on-screen height of the line's bounding box.  It is the only
/// signal available for "this is the big text across the top", which is where a
/// Pokemon card prints its name.
struct ScannedLine: Identifiable, Equatable {
    let id: UUID
    let text: String
    let height: CGFloat
}

extension ScannedLine {
    /// Barcodes are ignored; only recognised text becomes a line.
    init?(item: RecognizedItem) {
        guard case .text(let recognized) = item else { return nil }
        let trimmed = recognized.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let box = item.bounds
        let left = abs(box.bottomLeft.y - box.topLeft.y)
        let right = abs(box.bottomRight.y - box.topRight.y)
        self.init(id: item.id, text: trimmed, height: max(left, right))
    }
}

/// Turns the lines the camera read into a search query.
///
/// Deliberately conservative: it returns nil rather than a guess.  Every line is
/// shown to the user verbatim, and nothing reaches the search box until they
/// tap, so a misread costs a tap instead of a wrong appraisal.
enum CardTextReader {
    /// Words printed on cards and slab labels that are never part of a name.
    ///
    /// Card suffixes that ARE part of the name — V, VMAX, VSTAR, ex, GX, EX —
    /// are deliberately absent: "Charizard VMAX" is a different card from
    /// "Charizard", and pricing them as one another is the whole bug class this
    /// app exists to avoid.
    private static let chrome: Set<String> = [
        "hp", "basic", "stage", "evolves", "from", "put", "damage",
        "pokemon", "pokémon", "trainer", "supporter", "item", "energy",
        "weakness", "resistance", "retreat", "illus", "ability", "attack",
        "psa", "bgs", "cgc", "sgc", "beckett", "mint", "gem", "mt", "gemmt",
        "authentic", "altered", "nintendo", "creatures", "gamefreak",
        "nm", "lp", "mp", "dmg", "holo", "foil", "reverse", "promo",
    ]

    /// The best candidate for the card's printed name, or nil if none is legible.
    static func cardName(in lines: [ScannedLine]) -> String? {
        lines
            .filter { isNameCandidate($0.text) }
            .max(by: { $0.height < $1.height })
            .map { clean($0.text) }
    }

    /// The first `4/102`-style collector number in view, or nil.
    static func collectorNumber(in lines: [ScannedLine]) -> String? {
        for line in lines {
            if let hit = slashNumber(in: line.text) { return hit }
        }
        return nil
    }

    /// nil means "nothing legible" — never a placeholder.
    static func query(from lines: [ScannedLine]) -> String? {
        guard let name = cardName(in: lines) else { return nil }
        guard let number = collectorNumber(in: lines) else { return name }
        return "\(name) \(number)"
    }

    private static func isNameCandidate(_ raw: String) -> Bool {
        let text = clean(raw)
        guard text.count >= 3, text.count <= 30 else { return false }
        let words = text.lowercased().split(separator: " ").map(String.init)
        // At least one plain alphabetic word that is not card chrome.  This is
        // what rejects "60 HP", "4/102", "STAGE 1" and "©2023 Nintendo".
        return words.contains { word in
            word.count >= 3 && word.allSatisfy(\.isLetter) && !chrome.contains(word)
        }
    }

    private static func clean(_ raw: String) -> String {
        raw.replacingOccurrences(of: "\n", with: " ")
            .split(separator: " ", omittingEmptySubsequences: true)
            .joined(separator: " ")
    }

    /// Hand-rolled rather than a regex so the matching rules are visible: one to
    /// three digits, a slash, one to three digits, spaces tolerated either side.
    private static func slashNumber(in text: String) -> String? {
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            guard chars[i].isNumber else {
                i += 1
                continue
            }
            var left = i
            while left < chars.count, chars[left].isNumber { left += 1 }
            var slash = left
            while slash < chars.count, chars[slash] == " " { slash += 1 }
            guard slash < chars.count, chars[slash] == "/" else {
                i = left
                continue
            }
            var rightStart = slash + 1
            while rightStart < chars.count, chars[rightStart] == " " { rightStart += 1 }
            var right = rightStart
            while right < chars.count, chars[right].isNumber { right += 1 }
            if left - i <= 3, right - rightStart >= 1, right - rightStart <= 3 {
                return String(chars[i..<left]) + "/" + String(chars[rightStart..<right])
            }
            i = left
        }
        return nil
    }
}

/// Reads the text off a card with the camera.
///
/// This is a real scanner: VisionKit's `DataScannerViewController` runs live
/// text recognition on the camera feed, entirely on the device.  Every line
/// under the viewfinder is a line the camera actually read.  It replaces a
/// placeholder that answered "Charizard 4/102" after a 1.2 second timer no
/// matter what the phone was pointed at.
///
/// Two rules it does not break:
///
///  - It never invents a result.  With nothing legible in frame the name stays
///    empty and the button stays disabled.
///  - It never searches on its own.  The query only reaches the scan box when
///    the user taps it.
struct CardScannerView: View {
    var onQuery: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var lines: [ScannedLine] = []
    @State private var permission: CameraPermission = .undetermined
    @State private var failure: String?

    private enum CameraPermission {
        case undetermined, granted, denied
    }

    private var suggestion: String? { CardTextReader.query(from: lines) }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Read a card")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { dismiss() }
                    }
                }
        }
        .task { await askForCamera() }
    }

    @ViewBuilder
    private var content: some View {
        if !DataScannerViewController.isSupported {
            unavailable(
                "This iPhone cannot run live text scanning",
                "Live text needs an iPhone with an A12 Bionic chip or newer, and it does not run in the Simulator at all.  Type the card name into the scan box instead."
            )
        } else if permission == .denied {
            unavailable(
                "DealDex has no camera access",
                "Turn the camera on for DealDex in Settings › Privacy & Security › Camera, then open this again."
            )
        } else if let failure {
            unavailable("The scanner stopped", failure)
        } else if permission == .granted {
            VStack(spacing: 0) {
                CardTextScanner(lines: $lines) { failure = $0 }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay(alignment: .center) {
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                Color.white.opacity(0.9),
                                style: StrokeStyle(lineWidth: 2, dash: [8, 5])
                            )
                            .frame(width: 240, height: 336)
                            .allowsHitTesting(false)
                    }
                readout
            }
        } else {
            ProgressView("Asking for the camera…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var readout: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(lines.isEmpty ? "NOTHING LEGIBLE YET" : "READ FROM THE CARD")
                .font(.caption2.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(.secondary)
            Text(
                lines.isEmpty
                    ? "Hold the camera over the card so the name across the top fills the frame."
                    : lines.prefix(6).map(\.text).joined(separator: " · ")
            )
            .font(.footnote)
            .foregroundStyle(.secondary)
            .lineLimit(3)
            .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                guard let suggestion else { return }
                onQuery(suggestion)
                dismiss()
            } label: {
                Text(suggestion.map { "Search \($0)" } ?? "No card name read yet")
                    .font(.headline)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.25, green: 0.29, blue: 0.20))
            .disabled(suggestion == nil)
        }
        .padding()
        .background(Color(red: 0.95, green: 0.94, blue: 0.90))
    }

    private func unavailable(_ title: String, _ detail: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.95, green: 0.94, blue: 0.90))
    }

    private func askForCamera() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            permission = .granted
        case .notDetermined:
            permission = await AVCaptureDevice.requestAccess(for: .video) ? .granted : .denied
        default:
            permission = .denied
        }
    }
}

/// The live camera feed with VisionKit text recognition running on it.
private struct CardTextScanner: UIViewControllerRepresentable {
    @Binding var lines: [ScannedLine]
    var onFailure: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let controller = DataScannerViewController(
            recognizedDataTypes: [.text()],
            qualityLevel: .balanced,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {
        context.coordinator.parent = self
        guard !context.coordinator.scanning else { return }
        context.coordinator.scanning = true
        guard DataScannerViewController.isAvailable else {
            report("The camera is not available right now.  Close this and try again.")
            return
        }
        do {
            try controller.startScanning()
        } catch {
            context.coordinator.scanning = false
            report("The camera would not start: \(error.localizedDescription)")
        }
    }

    /// Deferred by one turn of the run loop on purpose.  `updateUIViewController`
    /// runs inside a SwiftUI update, and writing `@State` from there is undefined
    /// behaviour — the failure banner would race the view it is replacing.
    private func report(_ message: String) {
        let onFailure = self.onFailure
        DispatchQueue.main.async { onFailure(message) }
    }

    static func dismantleUIViewController(
        _ controller: DataScannerViewController,
        coordinator: Coordinator
    ) {
        controller.stopScanning()
        coordinator.scanning = false
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var parent: CardTextScanner
        var scanning = false

        init(_ parent: CardTextScanner) {
            self.parent = parent
        }

        func dataScanner(
            _ scanner: DataScannerViewController,
            didAdd added: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            publish(allItems)
        }

        func dataScanner(
            _ scanner: DataScannerViewController,
            didUpdate updated: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            publish(allItems)
        }

        func dataScanner(
            _ scanner: DataScannerViewController,
            didRemove removed: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            publish(allItems)
        }

        func dataScanner(
            _ scanner: DataScannerViewController,
            becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable
        ) {
            scanning = false
            switch error {
            case .cameraRestricted:
                parent.onFailure("Camera use is restricted on this iPhone.  Check Settings › Screen Time › Content & Privacy Restrictions.")
            case .unsupported:
                parent.onFailure("This iPhone cannot run live text scanning.")
            @unknown default:
                parent.onFailure("The camera became unavailable.")
            }
        }

        /// Tallest line first, so `CardTextReader` sees the card's name near the top.
        private func publish(_ items: [RecognizedItem]) {
            let next = items
                .compactMap(ScannedLine.init(item:))
                .sorted { $0.height > $1.height }
            guard next != parent.lines else { return }
            parent.lines = next
        }
    }
}
