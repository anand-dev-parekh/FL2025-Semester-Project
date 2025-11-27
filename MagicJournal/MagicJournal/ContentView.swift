import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: SessionController

    var body: some View {
        Group {
            if session.isRestoringSession {
                ProgressView("Signing you in…")
                    .progressViewStyle(.circular)
            } else if let user = session.user {
                MainAppView(user: user)
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.user?.id ?? -1)
        .onAppear {
            #if DEBUG
            print("[MagicJournal] backendBaseURL:", AppConfig.backendBaseURL)
            #endif
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(SessionController(apiClient: .shared))
}
