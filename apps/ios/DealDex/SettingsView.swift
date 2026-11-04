import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject var desk: DeskModel
    @State private var ebayConnected = false
    @State private var ebayUsername: String?
    @State private var connectingEbay = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if desk.accountEmail.isEmpty {
                        SignInSectionView()
                    } else {
                        SignedInUserView()
                    }
                } header: {
                    Text("Account")
                } footer: {
                    Text(desk.accountEmail.isEmpty
                         ? "Sign in with Google, Apple, or X — the same accounts as dealdex.net.  Scan also works signed out with keys saved on this phone."
                         : "Pull copies keys onto this phone.  After that, DealDex keeps working if the site is down.")
                }

                Section {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("eBay")
                            if let user = ebayUsername {
                                Text("Connected as \(user)").font(.caption).foregroundStyle(.secondary)
                            } else if ebayConnected {
                                Text("Connected").font(.caption).foregroundStyle(.secondary)
                            } else {
                                Text("Required for auto-buy").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button(ebayConnected ? "Disconnect" : (connectingEbay ? "Opening…" : "Connect eBay")) {
                            Task { await connectOrDisconnectEbay() }
                        }
                        .disabled(connectingEbay)
                    }
                } header: {
                    Text("Connected accounts")
                } footer: {
                    Text("Tap Connect to grant DealDex permission to place Buy It Now orders on your behalf. Sign in once with each provider — no copy-pasted keys.")
                }

                Section {
                    SecureField("JustTCG Key", text: $desk.justTcg)
                    SecureField("PriceCharting Token", text: $desk.priceCharting)
                    SecureField("Pokémon TCG API Key", text: $desk.pokemonTcg)
                    Button("Save on This iPhone") { desk.saveKeys() }
                } header: {
                    Text("API Desks")
                } footer: {
                    Text("Keys stay on this phone.  DealDex talks to eBay, Mercari, TCGDex, and these desks directly.")
                }

                if let note = desk.accountNote {
                    Section {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(note.contains("cancelled") || note.contains("could not") || note.contains("failed") ? Color.red : Color.secondary)
                    }
                }
                if let note = desk.settingsNote {
                    Section {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func connectOrDisconnectEbay() async {
        if ebayConnected {
            // Future: server-side disconnect endpoint.
            ebayConnected = false
            ebayUsername = nil
            return
        }
        connectingEbay = true
        defer { connectingEbay = false }
        do {
            let url = try await EbayOAuth.start()
            await UIApplication.shared.open(url)
        } catch {
            desk.settingsNote = "Could not start eBay OAuth: \(error.localizedDescription)"
        }
    }
}

// MARK: - Sign-In & Account Sections

struct SignInSectionView: View {
    @EnvironmentObject var desk: DeskModel
    @State private var busyProvider: String?

    var body: some View {
        VStack(spacing: 10) {
            SocialSignInButton(
                title: "Sign in with Google",
                isBusy: desk.accountBusy && busyProvider == "google",
                action: {
                    busyProvider = "google"
                    Task {
                        await desk.signInSocial("google")
                        busyProvider = nil
                    }
                },
                mark: { GoogleMark() }
            )
            .disabled(desk.accountBusy)

            SocialSignInButton(
                title: "Sign in with Apple",
                isBusy: desk.accountBusy && busyProvider == "apple",
                action: {
                    busyProvider = "apple"
                    Task {
                        await desk.signInSocial("apple")
                        busyProvider = nil
                    }
                },
                mark: { AppleMark() }
            )
            .disabled(desk.accountBusy)

            SocialSignInButton(
                title: "Sign in with X",
                isBusy: desk.accountBusy && busyProvider == "twitter",
                action: {
                    busyProvider = "twitter"
                    Task {
                        await desk.signInSocial("twitter")
                        busyProvider = nil
                    }
                },
                mark: { XMark() }
            )
            .disabled(desk.accountBusy)
        }
        .padding(.vertical, 4)
    }
}

struct SignedInUserView: View {
    @EnvironmentObject var desk: DeskModel

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Signed in")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(desk.accountEmail)
                    .font(.body.weight(.semibold))
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.vertical, 4)

        Button {
            Task { await desk.pullKeys() }
        } label: {
            Label("Pull Keys from Account", systemImage: "arrow.down.circle")
        }
        .disabled(desk.accountBusy)

        Button {
            Task { await desk.pushKeys() }
        } label: {
            Label("Push Phone Keys to Account", systemImage: "arrow.up.circle")
        }
        .disabled(desk.accountBusy)

        Button(role: .destructive) {
            desk.signOut()
        } label: {
            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
        }
        .disabled(desk.accountBusy)
    }

}

/// Thin wrapper around `/api/settings/ebay/oauth/start` so the iOS Settings
/// screen can hand the user off to a system-browser OAuth consent flow.
/// The redirect lands on the same dealdex.net callback, which the user
/// reaches once they have a browser tab open — iOS will hand off back to
/// DealDex via the universal-link scheme when the eBay redirect returns
/// to the app.
enum EbayOAuth {
    static func start() async throws -> URL {
        var req = URLRequest(url: URL(string: "https://dealdex.net/api/settings/ebay/oauth/start")!)
        req.httpMethod = "POST"
        let (data, _) = try await URLSession.shared.data(for: req)
        let payload = try JSONDecoder().decode(StartResponse.self, from: data)
        guard let url = URL(string: payload.url) else {
            throw NSError(domain: "DealDex", code: 1, userInfo: [NSLocalizedDescriptionKey: "Bad consent URL"])
        }
        return url
    }
    private struct StartResponse: Decodable { let url: String }
}
