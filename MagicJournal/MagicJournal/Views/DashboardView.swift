import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var session: SessionController
    let user: UserProfile

    var body: some View {
        NavigationStack {
            List {
                if let pictureURL = user.picture {
                    Section("Profile") {
                        HStack(spacing: 16) {
                            AsyncImage(url: pictureURL) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFill()
                                case .failure:
                                    placeholderAvatar
                                case .empty:
                                    ProgressView()
                                @unknown default:
                                    placeholderAvatar
                                }
                            }
                            .frame(width: 64, height: 64)
                            .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.name)
                                    .font(.headline)
                                Text(user.email)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("Account") {
                    LabeledContent("Name", value: user.name)
                    LabeledContent("Email", value: user.email)
                    if let bio = user.bio, !bio.isEmpty {
                        LabeledContent("Bio", value: bio)
                    }
                }

                Section("Progress") {
                    LabeledContent("Level", value: "\(user.level)")
                    LabeledContent("XP", value: "\(user.xp)")
                }

                Section {
                    Button(role: .destructive, action: signOut) {
                        Label("Sign Out", systemImage: "arrow.backward.circle")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Hi, \(firstName)")
            .toolbarTitleDisplayMode(.inline)
            .onAppear {
                session.clearError()
            }
        }
    }

    private var firstName: String {
        user.name.split(separator: " ").first.map(String.init) ?? user.name
    }

    private var placeholderAvatar: some View {
        Image(systemName: "person.crop.circle.fill")
            .resizable()
            .scaledToFill()
            .foregroundStyle(.secondary)
    }

    private func signOut() {
        Task {
            await session.signOut()
        }
    }
}

#Preview {
    DashboardView(
        user: UserProfile(
            id: 1,
            oauthId: "demo",
            email: "demo@example.com",
            name: "Demo User",
            bio: "Loves building healthy habits",
            level: 3,
            streak: 7,
            xp: 240,
            onboardingComplete: true,
            themePreference: "dark",
            picture: URL(string: "https://example.com/avatar.png")
        )
    )
    .environmentObject(SessionController(apiClient: .shared))
}
