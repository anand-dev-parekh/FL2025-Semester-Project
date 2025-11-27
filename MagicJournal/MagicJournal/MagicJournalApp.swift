import SwiftUI

@main
struct MagicJournalApp: App {
    @StateObject private var sessionController = SessionController()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionController)
        }
    }
}
