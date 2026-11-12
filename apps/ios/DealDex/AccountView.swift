import SwiftUI

struct AccountView: View {
    @EnvironmentObject var desk: DeskModel

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
                         ? "Sign in with Google, Apple, or X — the same accounts as dealdex.net.  Scan works signed out with keys saved on this phone."
                         : "Pull copies keys onto this phone.  After that, DealDex keeps working if the site is down.")
                }

                if let note = desk.accountNote {
                    Section {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(note.contains("cancelled") || note.contains("could not") || note.contains("failed") ? Color.red : Color.secondary)
                    }
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
