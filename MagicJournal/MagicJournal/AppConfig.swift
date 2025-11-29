import Foundation

enum AppConfig {
    private static let isPreview = ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"

    static var googleIOSClientID: String {
        if isPreview { return "PREVIEW_IOS_CLIENT_ID" }
        return configString(for: "GOOGLE_IOS_CLIENT_ID", disallowing: ["REPLACE_WITH_IOS_CLIENT_ID"])
    }

    static var googleWebClientID: String {
        if isPreview { return "PREVIEW_WEB_CLIENT_ID" }
        return configString(for: "GOOGLE_WEB_CLIENT_ID", disallowing: ["REPLACE_WITH_WEB_CLIENT_ID"])
    }

    static var backendBaseURL: URL {
        if isPreview { return URL(string: "http://127.0.0.1:8080")! }
        let rawValue = configString(for: "BACKEND_BASE_URL")
        guard let url = URL(string: rawValue) else {
            fatalError("BACKEND_BASE_URL in Info.plist must be a valid URL string.")
        }
        return url
    }

    private static func configString(for key: String, disallowing invalidValues: [String] = []) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty else {
            fatalError("Missing \(key) in Info.plist. Update your configuration.")
        }
        if invalidValues.contains(value) {
            fatalError("Replace the placeholder value for \(key) in your configuration files.")
        }
        return value
    }
}
