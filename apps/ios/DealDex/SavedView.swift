import SwiftUI

struct SavedView: View {
    @StateObject private var store = SavedStore()
    @State private var filter: String = "all"

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                if !store.items.isEmpty {
                    Picker("Filter", selection: $filter) {
                        Text("All (\(store.items.count))").tag("all")
                        Text("Watching").tag("watching")
                        Text("Bought").tag("bought")
                        Text("Passed").tag("passed")
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                }

                if filteredItems.isEmpty {
                    VStack(spacing: 12) {
                        Spacer()
                        Image(systemName: "bookmark")
                            .font(.system(size: 44))
                            .foregroundStyle(.secondary)
                        Text("No saved appraisals yet.")
                            .font(.headline)
                        Text("Appraise a listing or tap save on any scan to build your deal ledger.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    List {
                        ForEach(filteredItems) { item in
                            SavedRowView(item: item) { newStatus in
                                store.updateStatus(id: item.id, status: newStatus)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    store.delete(id: item.id)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color(red: 0.95, green: 0.94, blue: 0.90))
            .navigationTitle("Saved Ledger")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                store.load()
            }
        }
    }

    private var filteredItems: [SavedAppraisal] {
        if filter == "all" { return store.items }
        return store.items.filter { $0.status == filter }
    }
}

struct SavedRowView: View {
    let item: SavedAppraisal
    let onStatusChange: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(item.cardName)
                    .font(.headline)
                Spacer()
                Text(item.verdict.uppercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(verdictColor(item.verdict))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(verdictColor(item.verdict).opacity(0.12)))
            }

            Text("\(item.setName) #\(item.localId) · \(item.condition)\(item.grade != "raw" ? " · \(item.grade)" : "")")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Text(String(format: "Ask $%.2f", item.listingPrice))
                    .font(.caption.monospaced())
                if let book = item.marketPrice {
                    Text(String(format: "Book $%.2f", book))
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                if let s = item.spread {
                    Text(String(format: "%+.1f%%", s * 100))
                        .font(.caption.monospaced().weight(.semibold))
                        .foregroundStyle(verdictColor(item.verdict))
                }
            }

            HStack(spacing: 8) {
                Menu {
                    Button("Watching") { onStatusChange("watching") }
                    Button("Bought") { onStatusChange("bought") }
                    Button("Passed") { onStatusChange("passed") }
                } label: {
                    HStack(spacing: 4) {
                        Text(item.status.capitalized)
                        Image(systemName: "chevron.down").font(.caption2)
                    }
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(statusColor(item.status).opacity(0.15)))
                    .foregroundStyle(statusColor(item.status))
                }

                Spacer()

                Text(item.createdAt, style: .date)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 6)
    }

    private func verdictColor(_ v: String) -> Color {
        switch v {
        case "steal", "good": return Color(red: 0.25, green: 0.35, blue: 0.22)
        case "high", "avoid": return Color(red: 0.56, green: 0.31, blue: 0.27)
        default: return Color(red: 0.48, green: 0.40, blue: 0.22)
        }
    }

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "bought": return Color(red: 0.25, green: 0.45, blue: 0.25)
        case "passed": return .secondary
        default: return Color(red: 0.20, green: 0.35, blue: 0.65)
        }
    }
}
