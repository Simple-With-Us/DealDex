import SwiftUI
import UserNotifications

struct AlertsView: View {
    @EnvironmentObject var desk: DeskModel

    var body: some View {
        NavigationStack {
            Form {
                Section("Native deal pings") {
                    TextField("Name", text: $desk.rule.name)
                    TextField("Keyword (blank = all Pokémon)", text: $desk.rule.keyword)
                    TextField("Max ask", text: maxAsk)
                        .keyboardType(.decimalPad)
                    TextField("Min spread %", text: minSpread)
                        .keyboardType(.decimalPad)
                    Toggle("Alerts on", isOn: $desk.rule.enabled)
                }
                Section {
                    Toggle("Email me", isOn: $desk.rule.channels.emailToggle)
                    if desk.rule.channels.emailToggle {
                        TextField("Email address", text: $desk.rule.channels.email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    Toggle("SMS me", isOn: $desk.rule.channels.smsToggle)
                    if desk.rule.channels.smsToggle {
                        TextField("Mobile number (E.164)", text: $desk.rule.channels.phone)
                            .keyboardType(.phonePad)
                    }
                    Toggle("Pushover", isOn: $desk.rule.channels.pushoverToggle)
                    if desk.rule.channels.pushoverToggle {
                        TextField("Pushover user key", text: $desk.rule.channels.pushoverUser)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("Pushover API token", text: $desk.rule.channels.pushoverToken)
                    }
                } header: {
                    Text("Out-of-app channels")
                } footer: {
                    Text("Out-of-app channels are gated by server-side providers; the alert config is saved locally today and the runner will pick it up once the providers are wired (server-side PR #7).")
                }
                Section {
                    Toggle("Buy It Now within caps", isOn: $desk.rule.autoBuy.enabled)
                    if desk.rule.autoBuy.enabled {
                        TextField("Max all-in (cents)", text: autoBuyMaxCents)
                            .keyboardType(.numberPad)
                        TextField("Min spread (0..1)", text: autoBuyMinSpread)
                            .keyboardType(.decimalPad)
                        TextField("Max daily (cents)", text: autoBuyMaxDaily)
                            .keyboardType(.numberPad)
                        TextField("Max monthly (cents)", text: autoBuyMaxMonthly)
                            .keyboardType(.numberPad)
                        TextField("Cooldown (hours)", text: autoBuyCoolHours)
                            .keyboardType(.numberPad)
                        Toggle("Dry-run (recommended)", isOn: $desk.rule.autoBuy.dryRun)
                    }
                } header: {
                    Text("Auto-buy (dry-run by default)")
                } footer: {
                    Text("Auto-buy is dry-run by default. Flipping dry-run off is gated server-side and requires an explicit confirmation.")
                }
                Section {
                    Button("Scan now and notify") {
                        Task {
                            await Self.askNotify()
                            await desk.scan(notify: true)
                        }
                    }
                } footer: {
                    Text("Matches fire after each scan on this phone.")
                }
            }
            .navigationTitle("Alerts")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private static func askNotify() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
    }

    private var maxAsk: Binding<String> {
        Binding(
            get: { desk.rule.maxPrice.map { String(Int($0)) } ?? "" },
            set: { desk.rule.maxPrice = Double($0) }
        )
    }

    private var minSpread: Binding<String> {
        Binding(
            get: { desk.rule.minSpread.map { String(Int($0 * 100)) } ?? "" },
            set: { desk.rule.minSpread = Double($0).map { $0 / 100 } }
        )
    }

    private var autoBuyMaxCents: Binding<String> {
        Binding(
            get: { String(desk.rule.autoBuy.maxPriceCents) },
            set: { desk.rule.autoBuy.maxPriceCents = max(0, Int($0) ?? 0) },
        )
    }
    private var autoBuyMinSpread: Binding<String> {
        Binding(
            get: { String(desk.rule.autoBuy.minSpread) },
            set: { desk.rule.autoBuy.minSpread = max(0, min(1, Double($0) ?? 0)) },
        )
    }
    private var autoBuyMaxDaily: Binding<String> {
        Binding(
            get: { String(desk.rule.autoBuy.maxDailyCents) },
            set: { desk.rule.autoBuy.maxDailyCents = max(0, Int($0) ?? 0) },
        )
    }
    private var autoBuyMaxMonthly: Binding<String> {
        Binding(
            get: { String(desk.rule.autoBuy.maxMonthlyCents) },
            set: { desk.rule.autoBuy.maxMonthlyCents = max(0, Int($0) ?? 0) },
        )
    }
    private var autoBuyCoolHours: Binding<String> {
        Binding(
            get: { String(desk.rule.autoBuy.coolHours) },
            set: { desk.rule.autoBuy.coolHours = max(0, Int($0) ?? 0) },
        )
    }
}
