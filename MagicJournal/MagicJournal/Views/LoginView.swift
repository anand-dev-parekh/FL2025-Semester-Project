import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionController

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            VStack(spacing: 12) {
                Image(systemName: "wand.and.stars")
                    .font(.system(size: 56))
                    .foregroundStyle(.tint)
                Text("Magic Journal")
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                Text("Sign in with your Google account to continue. Use the same account you use on the web app.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }

            if let error = session.lastError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button(action: startSignIn) {
                HStack(spacing: 12) {
                    Image(systemName: "g.circle.fill")
                    Text(session.isAuthenticating ? "Signing in…" : "Continue with Google")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(session.isAuthenticating)

            Text("Only existing Magic Journal accounts can sign in. Create your account on the web before using the app.")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding()
    }

    private func startSignIn() {
        Task {
            await session.startGoogleSignIn()
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(SessionController(apiClient: .shared))
}
