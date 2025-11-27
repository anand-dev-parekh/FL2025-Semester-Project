import SwiftUI

struct MainAppView: View {
    let user: UserProfile

    var body: some View {
        TabView {
            DashboardView(user: user)
                .tabItem {
                    Label("Home", systemImage: "person.crop.circle")
                }

            HealthDemoView()
                .tabItem {
                    Label("Health", systemImage: "heart.circle")
                }
        }
    }
}

#Preview {
    MainAppView(user: UserProfile(
        id: 1,
        oauthId: "demo",
        email: "demo@example.com",
        name: "Demo User",
        bio: "Explorer",
        level: 1,
        streak: 0,
        xp: 120,
        onboardingComplete: false,
        themePreference: nil,
        picture: nil
    ))
        .environmentObject(SessionController(apiClient: .shared))
}
