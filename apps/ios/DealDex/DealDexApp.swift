import SwiftUI

@main
struct DealDexApp: App {
    init() {
        SentryTelemetry.start()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @StateObject private var desk = DeskModel()
    @State private var selectedTab: Int = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            ScanView()
                .environmentObject(desk)
                .tabItem { Label("Scan", systemImage: "dot.radiowaves.left.and.right") }
                .tag(0)
            EvaluatorView()
                .tabItem { Label("Evaluator", systemImage: "slider.horizontal.3") }
                .tag(1)
            SavedView()
                .tabItem { Label("Saved", systemImage: "bookmark") }
                .tag(2)
            AlertsView()
                .environmentObject(desk)
                .tabItem { Label("Alerts", systemImage: "bell") }
                .tag(3)
            SettingsView()
                .environmentObject(desk)
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(4)
        }
        .tint(Color(red: 63 / 255, green: 74 / 255, blue: 50 / 255))
        .preferredColorScheme(.light)
        .appUpdatePrompt()
    }
}
