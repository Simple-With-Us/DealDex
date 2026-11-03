import Foundation

@MainActor
class SavedStore: ObservableObject {
    @Published var items: [SavedAppraisal] = []

    private let key = "dealdex_saved_appraisals"

    init() {
        load()
    }

    func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([SavedAppraisal].self, from: data) else {
            return
        }
        self.items = decoded
    }

    func save(item: SavedAppraisal) {
        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            items[idx] = item
        } else {
            items.insert(item, at: 0)
        }
        persist()
    }

    func delete(id: String) {
        items.removeAll { $0.id == id }
        persist()
    }

    func updateStatus(id: String, status: String) {
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx].status = status
            persist()
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
