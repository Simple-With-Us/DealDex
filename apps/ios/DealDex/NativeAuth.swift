import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

enum NativeAuthError: LocalizedError {
    case cancelled
    case missingToken
    case server(String)

    var errorDescription: String? {
        switch self {
        case .cancelled: return "Sign-in was cancelled."
        case .missingToken: return "Sign-in did not complete.  Try again."
        case .server(let m): return m
        }
    }
}

final class NativeAuthPresenter: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let key = scenes.flatMap(\.windows).first(where: \.isKeyWindow) { return key }
        if let any = scenes.flatMap(\.windows).first { return any }
        return ASPresentationAnchor()
    }
}

enum NativeAuth {
    static let defaultOrigin = "https://dealdex.net"
    private static var heldSession: ASWebAuthenticationSession?
    private static var heldPresenter: NativeAuthPresenter?

    // MARK: - Native Apple Sign In

    /// Sign in with Apple using the native iOS sheet (Face ID / Touch ID).
    ///
    /// Uses ASAuthorizationAppleIDProvider — no web browser, no form_post redirect.
    /// The identity token Apple returns is sent directly to /api/native/apple-signin
    /// which validates it server-side and returns a DealDex session token.
    static func signInApple(origin: String) async throws -> AccountApi.Session {
        let site = Self.normalized(origin)
        let credential = try await requestAppleCredential()
        guard let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8)
        else {
            throw NativeAuthError.missingToken
        }

        // Apple only provides name on the very first authorization — capture it.
        var userPayload: [String: Any] = [:]
        if let fullName = credential.fullName {
            if let first = fullName.givenName,  !first.isEmpty { userPayload["firstName"] = first }
            if let last  = fullName.familyName, !last.isEmpty  { userPayload["lastName"]  = last  }
        }
        if let email = credential.email, !email.isEmpty {
            userPayload["email"] = email
        }

        return try await exchangeAppleToken(
            site: site,
            identityToken: identityToken,
            user: userPayload.isEmpty ? nil : userPayload
        )
    }

    /// Shows the native Apple Sign In authorization sheet and returns the credential.
    ///
    /// Continuation bodies are nonisolated.  Hop onto MainActor before constructing
    /// `AppleSignInDelegate` (ios-ship archive, Swift 6 targeted concurrency).
    private static func requestAppleCredential() async throws -> ASAuthorizationAppleIDCredential {
        try await withCheckedThrowingContinuation { cont in
            Task { @MainActor in
                let provider = ASAuthorizationAppleIDProvider()
                let request = provider.createRequest()
                request.requestedScopes = [.email, .fullName]
                let controller = ASAuthorizationController(authorizationRequests: [request])
                let delegate = AppleSignInDelegate(continuation: cont)
                controller.delegate = delegate
                controller.presentationContextProvider = delegate
                delegate.controller = controller
                AppleSignInDelegate.held = delegate
                controller.performRequests()
            }
        }
    }

    /// POST identityToken to the server, receive a DealDex session token.
    private static func exchangeAppleToken(
        site: String,
        identityToken: String,
        user: [String: Any]?
    ) async throws -> AccountApi.Session {
        guard let url = URL(string: "\(site)/api/native/apple-signin") else {
            throw NativeAuthError.server("Website origin is not a valid URL.")
        }
        var body: [String: Any] = ["identityToken": identityToken]
        if let user { body["user"] = user }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("DealDex/1.0 (ios)", forHTTPHeaderField: "User-Agent")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, res) = try await URLSession.shared.data(for: req)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        if status >= 400 {
            throw NativeAuthError.server(json["error"] as? String ?? "Apple sign-in could not be completed.")
        }
        guard let token = json["token"] as? String, !token.isEmpty else {
            throw NativeAuthError.missingToken
        }
        return AccountApi.Session(token: token, email: json["email"] as? String ?? "")
    }

    /// PKCE verifier: high-entropy, generated per attempt, never leaves the app.
    ///
    /// Uses CryptoKit's own CSPRNG rather than `SecRandomCopyBytes`, whose
    /// OSStatus we were discarding — on failure the buffer stayed as 32 zero
    /// bytes and every device would have produced the same, entirely
    /// predictable verifier.  `SymmetricKey(size:)` cannot fail that way.
    private static func newVerifier() -> String {
        SymmetricKey(size: .bits256).withUnsafeBytes { Data($0).base64URLEncoded() }
    }

    private static func challenge(for verifier: String) -> String {
        Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded()
    }

    /// Sign in through the website, then trade a single-use code for the session
    /// token.
    ///
    /// The callback lands on `dealdex://`, a custom scheme that is not exclusive
    /// to this app. It used to carry the live session token, so anything that
    /// claimed the scheme could take over the account. Now it carries only a
    /// code, and redeeming it needs the verifier held here.
    static func signIn(origin: String, provider: String = "google") async throws -> AccountApi.Session {
        let site = Self.normalized(origin)
        let verifier = newVerifier()
        let challengeValue = challenge(for: verifier)
        guard
            let start = URL(
                string: "\(site)/api/native/oauth?provider=\(provider)&challenge=\(challengeValue)"
            )
        else {
            throw NativeAuthError.server("Website origin is not a valid URL.")
        }
        let presenter = NativeAuthPresenter()
        let callback = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: start, callbackURLScheme: "dealdex") { url, error in
                heldSession = nil
                heldPresenter = nil
                if let error {
                    let ns = error as NSError
                    if ns.domain == ASWebAuthenticationSessionError.errorDomain,
                       ns.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        cont.resume(throwing: NativeAuthError.cancelled)
                    } else {
                        cont.resume(throwing: error)
                    }
                    return
                }
                guard let url else {
                    cont.resume(throwing: NativeAuthError.missingToken)
                    return
                }
                cont.resume(returning: url)
            }
            session.presentationContextProvider = presenter
            session.prefersEphemeralWebBrowserSession = false
            heldPresenter = presenter
            heldSession = session
            if !session.start() {
                heldSession = nil
                heldPresenter = nil
                cont.resume(throwing: NativeAuthError.server("Could not start sign-in."))
            }
        }
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let dict = Dictionary(uniqueKeysWithValues: items.compactMap { item in
            item.value.map { (item.name, $0) }
        })
        if let err = dict["error"], !err.isEmpty {
            throw NativeAuthError.server(err.replacingOccurrences(of: "_", with: " "))
        }
        guard let code = dict["code"], !code.isEmpty else {
            throw NativeAuthError.missingToken
        }
        return try await exchange(site: site, code: code, verifier: verifier)
    }

    /// Second leg: `code` + `verifier` -> session token, over HTTPS.
    private static func exchange(site: String, code: String, verifier: String) async throws -> AccountApi.Session {
        guard let url = URL(string: "\(site)/api/native/exchange") else {
            throw NativeAuthError.server("Website origin is not a valid URL.")
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("DealDex/1.0 (ios)", forHTTPHeaderField: "User-Agent")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "verifier": verifier])
        let (data, res) = try await URLSession.shared.data(for: req)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        if status >= 400 {
            throw NativeAuthError.server(json["error"] as? String ?? "Sign-in could not be completed.")
        }
        guard let token = json["token"] as? String, !token.isEmpty else {
            throw NativeAuthError.missingToken
        }
        return AccountApi.Session(token: token, email: json["email"] as? String ?? "")
    }

    static func normalized(_ origin: String) -> String {
        var s = origin.trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if s.isEmpty { return defaultOrigin }
        if !s.contains("://") { s = "https://\(s)" }
        return s
    }
}


private extension Data {
    /// base64url, matching what the server's `base64url` encoding expects.
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

// MARK: - Apple Sign In Delegate

/// Bridges ASAuthorizationController's delegate callbacks into Swift Concurrency.
@MainActor
final class AppleSignInDelegate: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    /// Keeps the delegate alive until the callback fires (ARC would otherwise release it).
    static var held: AppleSignInDelegate?

    /// `performRequests()` returns immediately; the controller must outlive the
    /// presenting `Task` until Apple calls back.
    var controller: ASAuthorizationController?

    private var continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>?

    init(continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>) {
        self.continuation = continuation
    }

    private func finish(_ result: Result<ASAuthorizationAppleIDCredential, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        Self.held = nil
        controller = nil
        continuation.resume(with: result)
    }

    // MARK: ASAuthorizationControllerDelegate

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
            finish(.success(credential))
        } else {
            finish(.failure(NativeAuthError.missingToken))
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let ns = error as NSError
        if ns.domain == ASAuthorizationError.errorDomain,
           ns.code == ASAuthorizationError.canceled.rawValue
        {
            finish(.failure(NativeAuthError.cancelled))
        } else {
            finish(.failure(error))
        }
    }

    // MARK: ASAuthorizationControllerPresentationContextProviding

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let key = scenes.flatMap(\.windows).first(where: \.isKeyWindow) { return key }
        if let any = scenes.flatMap(\.windows).first { return any }
        return ASPresentationAnchor()
    }
}
