import Foundation

struct UserProfile: Codable, Identifiable {
    let id: Int
    let oauthId: String
    let email: String
    let name: String
    let bio: String?
    let level: Int
    let streak: Int
    let xp: Int
    let onboardingComplete: Bool?
    let themePreference: String?
    let picture: URL?

    private enum CodingKeys: String, CodingKey {
        case id
        case oauthId
        case email
        case name
        case bio
        case level
        case streak
        case xp
        case onboardingComplete
        case themePreference
        case picture
    }

    init(
        id: Int,
        oauthId: String,
        email: String,
        name: String,
        bio: String?,
        level: Int,
        streak: Int,
        xp: Int,
        onboardingComplete: Bool?,
        themePreference: String?,
        picture: URL?
    ) {
        self.id = id
        self.oauthId = oauthId
        self.email = email
        self.name = name
        self.bio = bio
        self.level = level
        self.streak = streak
        self.xp = xp
        self.onboardingComplete = onboardingComplete
        self.themePreference = themePreference
        self.picture = picture
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(Int.self, forKey: .id)
        oauthId = try container.decode(String.self, forKey: .oauthId)
        email = try container.decode(String.self, forKey: .email)
        name = try container.decode(String.self, forKey: .name)
        bio = try container.decodeIfPresent(String.self, forKey: .bio)
        level = try container.decode(Int.self, forKey: .level)
        streak = try container.decode(Int.self, forKey: .streak)
        xp = try container.decodeIfPresent(Int.self, forKey: .xp) ?? 0
        onboardingComplete = try container.decodeIfPresent(Bool.self, forKey: .onboardingComplete)
        themePreference = try container.decodeIfPresent(String.self, forKey: .themePreference)

        if let pictureString = try container.decodeIfPresent(String.self, forKey: .picture),
           let pictureURL = URL(string: pictureString) {
            picture = pictureURL
        } else {
            picture = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(oauthId, forKey: .oauthId)
        try container.encode(email, forKey: .email)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(bio, forKey: .bio)
        try container.encode(level, forKey: .level)
        try container.encode(streak, forKey: .streak)
        try container.encode(xp, forKey: .xp)
        try container.encodeIfPresent(onboardingComplete, forKey: .onboardingComplete)
        try container.encodeIfPresent(themePreference, forKey: .themePreference)
        try container.encodeIfPresent(picture?.absoluteString, forKey: .picture)
    }
}
