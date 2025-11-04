import Foundation

enum APIError: LocalizedError {
    case invalidResponse
    case decodingFailed
    case httpError(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server response was invalid."
        case .decodingFailed:
            return "Failed to decode the server response."
        case .httpError(let status, let message):
            return message.isEmpty ? "Server returned status code \(status)." : message
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(session: URLSession = .shared, baseURL: URL = AppConfig.backendBaseURL) {
        self.session = session
        self.baseURL = baseURL

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder
    }

    func authenticateWithGoogle(idToken: String, allowAccountCreation: Bool) async throws -> UserProfile {
        struct Payload: Encodable {
            let idToken: String
            let allowCreate: Bool
        }

        var request = URLRequest(url: endpoint("api/auth/google"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(Payload(idToken: idToken, allowCreate: allowAccountCreation))

        let (data, response) = try await session.data(for: request)
        return try handleResponse(data: data, response: response)
    }

    func currentUser() async throws -> UserProfile? {
        var request = URLRequest(url: endpoint("api/auth/me"))
        request.httpMethod = "GET"
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200:
            return try decoder.decode(UserProfile.self, from: data)
        case 401:
            return nil
        default:
            throw makeHTTPError(statusCode: httpResponse.statusCode, data: data)
        }
    }

    func logout() async throws {
        var request = URLRequest(url: endpoint("api/auth/logout"))
        request.httpMethod = "POST"
        let (data, response) = try await session.data(for: request)
        struct Empty: Decodable {}
        _ = try handleResponse(data: data, response: response) as Empty
    }

    // MARK: - Helpers

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }

    private func handleResponse<T: Decodable>(data: Data, response: URLResponse) throws -> T {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                #if DEBUG
                print("[MagicJournal] decode failure for", T.self, "error:", error)
                if let raw = String(data: data, encoding: .utf8) {
                    print("[MagicJournal] raw response:", raw)
                }
                #endif
                throw APIError.decodingFailed
            }
        default:
            throw makeHTTPError(statusCode: httpResponse.statusCode, data: data)
        }
    }

    private func makeHTTPError(statusCode: Int, data: Data) -> APIError {
        if let message = decodeErrorMessage(from: data) {
            return .httpError(status: statusCode, message: message)
        }
        return .httpError(status: statusCode, message: "")
    }

    private func decodeErrorMessage(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        struct ErrorEnvelope: Decodable { let error: String; let detail: String? }
        if let envelope = try? decoder.decode(ErrorEnvelope.self, from: data) {
            if let detail = envelope.detail, !detail.isEmpty {
                return "\(envelope.error): \(detail)"
            }
            return envelope.error
        }
        if let jsonObject = try? JSONSerialization.jsonObject(with: data, options: []),
           let dict = jsonObject as? [String: Any] {
            if let message = dict["message"] as? String { return message }
            if let error = dict["error"] as? String { return error }
        }
        return nil
    }
}
