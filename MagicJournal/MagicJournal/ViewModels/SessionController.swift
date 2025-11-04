import Combine
import Foundation
import GoogleSignIn
import UIKit

@MainActor
final class SessionController: ObservableObject {
    @Published private(set) var user: UserProfile?
    @Published var isRestoringSession = true
    @Published var isAuthenticating = false
    @Published var lastError: String?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: AppConfig.googleIOSClientID,
            serverClientID: AppConfig.googleWebClientID
        )

        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            isRestoringSession = false
            return
        }

        Task { [weak self] in
            await self?.restorePreviousGoogleSession()
            await self?.refreshSession()
        }
    }

    func refreshSession() async {
        isRestoringSession = true
        defer { isRestoringSession = false }

        do {
            user = try await apiClient.currentUser()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func startGoogleSignIn() async {
        guard !isAuthenticating else { return }

        isAuthenticating = true
        lastError = nil
        defer { isAuthenticating = false }

        guard let presentingViewController = UIApplication.topViewController() else {
            lastError = "Unable to find a view controller to present Google Sign-In."
            return
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)
            guard let idToken = result.user.idToken?.tokenString else {
                throw APIError.httpError(status: 0, message: "Google did not return an ID token.")
            }

            let profile = try await apiClient.authenticateWithGoogle(idToken: idToken, allowAccountCreation: false)
            user = profile
        } catch {
            if let apiError = error as? APIError, case .httpError(let status, let message) = apiError, status == 403 {
                lastError = message.isEmpty ? "No account exists for this Google user. Please create an account via the web app before signing in." : message
            } else if let localized = error as? LocalizedError, let description = localized.errorDescription {
                lastError = description
            } else {
                lastError = error.localizedDescription
            }
            GIDSignIn.sharedInstance.signOut()
        }
    }

    func signOut() async {
        do {
            try await apiClient.logout()
        } catch {
            lastError = error.localizedDescription
        }
        GIDSignIn.sharedInstance.signOut()
        user = nil
    }

    func clearError() {
        lastError = nil
    }

    private func restorePreviousGoogleSession() async {
        do {
            _ = try await GIDSignIn.sharedInstance.restorePreviousSignIn()
        } catch {
            // Safe to ignore: the user will just be prompted to sign in manually.
        }
    }
}
