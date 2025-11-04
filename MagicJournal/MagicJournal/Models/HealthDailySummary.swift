import Foundation

struct HealthDailySummary: Identifiable, Codable, Hashable {
    let date: Date
    let steps: Int
    let exerciseMinutes: Int
    let sleepMinutes: Int

    var id: String { isoDateString }

    var isoDateString: String {
        HealthDailySummary.isoDateFormatter.string(from: date)
    }

    var displayDate: String {
        HealthDailySummary.displayFormatter.string(from: date)
    }

    private enum CodingKeys: String, CodingKey {
        case date
        case steps
        case exerciseMinutes
        case sleepMinutes
    }

    init(date: Date, steps: Int, exerciseMinutes: Int, sleepMinutes: Int) {
        self.date = date
        self.steps = steps
        self.exerciseMinutes = exerciseMinutes
        self.sleepMinutes = sleepMinutes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let dateString = try container.decode(String.self, forKey: .date)
        guard let parsedDate = HealthDailySummary.isoDateFormatter.date(from: dateString) else {
            throw DecodingError.dataCorruptedError(forKey: .date, in: container, debugDescription: "Invalid date string")
        }
        self.date = parsedDate
        self.steps = try container.decode(Int.self, forKey: .steps)
        self.exerciseMinutes = try container.decode(Int.self, forKey: .exerciseMinutes)
        self.sleepMinutes = try container.decode(Int.self, forKey: .sleepMinutes)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(isoDateString, forKey: .date)
        try container.encode(steps, forKey: .steps)
        try container.encode(exerciseMinutes, forKey: .exerciseMinutes)
        try container.encode(sleepMinutes, forKey: .sleepMinutes)
    }

    private static let isoDateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeZone = TimeZone.current
        return formatter
    }()
}
