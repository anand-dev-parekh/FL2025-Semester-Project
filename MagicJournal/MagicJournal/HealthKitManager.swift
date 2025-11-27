import Foundation
import HealthKit

final class HealthKitManager {
    static let shared = HealthKitManager()
    private init() {}

    private let store = HKHealthStore()

    var isHealthDataAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    // 👇️ The most common read types so your demo actually shows data
    private var readTypes: Set<HKObjectType> {
        var set = Set<HKObjectType>()

        // Quantity types most users have
        let quantityIds: [HKQuantityTypeIdentifier] = [
            .stepCount,
            .appleExerciseTime,
            .activeEnergyBurned,
            .distanceWalkingRunning,
            .heartRate
        ]
        quantityIds.forEach { if let t = HKObjectType.quantityType(forIdentifier: $0) { set.insert(t) } }

        // Workouts
        set.insert(HKObjectType.workoutType())

        // Sleep (category)
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            set.insert(sleep)
        }

        return set
    }

    private var requiredReadTypes: [HKObjectType] {
        var required = [HKObjectType]()
        if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) {
            required.append(steps)
        }
        if let exercise = HKObjectType.quantityType(forIdentifier: .appleExerciseTime) {
            required.append(exercise)
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            required.append(sleep)
        }
        return required
    }

    @MainActor
    func requestAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw NSError(domain: "HealthKit", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health data not available on this device."])
        }
        // Ask to READ only (no writes needed for demo)
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    // Export last N days as JSON – steps, workouts, heart rate (limited), sleep summary
    func exportHealthDataJSON(forPastDays days: Int) async throws -> String {
        let end = Date()
        guard let start = Calendar.current.date(byAdding: .day, value: -days, to: end) else { return "" }

        // Run queries in parallel
        async let steps = fetchQuantitySamples(.stepCount, start: start, end: end, limit: 1000)
        async let workouts = fetchWorkouts(start: start, end: end, limit: 200)
        async let hr = fetchQuantitySamples(.heartRate, start: start, end: end, limit: 2000) // cap for demo
        async let sleep = fetchSleepSummary(start: start, end: end)

        let result: [String: Any] = [
            "range": [
                "start": ISO8601DateFormatter().string(from: start),
                "end": ISO8601DateFormatter().string(from: end)
            ],
            "stepCountSamples": try await steps,
            "workouts": try await workouts,
            "heartRateSamples": try await hr,
            "sleepSummary": try await sleep
        ]

        let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted])
        return String(data: data, encoding: .utf8) ?? ""
    }

    func fetchDailySummaries(forPastDays days: Int) async throws -> [HealthDailySummary] {
        guard days > 0 else { return [] }
        guard isHealthDataAvailable else {
            throw NSError(domain: "HealthKit", code: 2, userInfo: [NSLocalizedDescriptionKey: "Health data is unavailable on this device."])
        }
        let calendar = Calendar.current
        let now = Date()
        let anchorDay = calendar.startOfDay(for: now)
        guard let startDate = calendar.date(byAdding: .day, value: -(days - 1), to: anchorDay) else {
            return []
        }

        async let stepTotalsTask = dailyCumulativeSum(
            for: .stepCount,
            unit: .count(),
            start: startDate,
            end: now
        )
        async let exerciseTotalsTask = dailyCumulativeSum(
            for: .appleExerciseTime,
            unit: .minute(),
            start: startDate,
            end: now
        )
        async let sleepTotalsTask = dailySleepMinutes(start: startDate, end: now)

        let stepTotals = try await stepTotalsTask

        let exerciseTotals: [Date: Double]
        do {
            exerciseTotals = try await exerciseTotalsTask
        } catch {
            #if DEBUG
            print("[HealthKitManager] Exercise minutes not available:", error.localizedDescription)
            #endif
            exerciseTotals = [:]
        }

        let sleepTotals: [Date: Double]
        do {
            sleepTotals = try await sleepTotalsTask
        } catch {
            #if DEBUG
            print("[HealthKitManager] Sleep data not available:", error.localizedDescription)
            #endif
            sleepTotals = [:]
        }

        var summaries = [HealthDailySummary]()
        for offset in 0..<days {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: anchorDay) else { continue }
            let startOfDay = calendar.startOfDay(for: day)
            let steps = Int((stepTotals[startOfDay] ?? 0).rounded())
            let exerciseMinutes = Int((exerciseTotals[startOfDay] ?? 0).rounded())
            let sleepMinutes = Int((sleepTotals[startOfDay] ?? 0).rounded())
            summaries.append(
                HealthDailySummary(
                    date: startOfDay,
                    steps: max(0, steps),
                    exerciseMinutes: max(0, exerciseMinutes),
                    sleepMinutes: max(0, sleepMinutes)
                )
            )
        }

        return summaries.sorted { $0.date > $1.date }
    }

    // MARK: - Helpers

    private func dailyCumulativeSum(for identifier: HKQuantityTypeIdentifier, unit: HKUnit, start: Date, end: Date) async throws -> [Date: Double] {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return [:] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let interval = DateComponents(day: 1)
        let calendar = Calendar.current
        let anchor = calendar.startOfDay(for: end)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: [.cumulativeSum],
                anchorDate: anchor,
                intervalComponents: interval
            )

            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                var results: [Date: Double] = [:]
                collection?.enumerateStatistics(from: start, to: end) { statistics, _ in
                    let day = calendar.startOfDay(for: statistics.startDate)
                    if let value = statistics.sumQuantity()?.doubleValue(for: unit) {
                        results[day] = value
                    } else if results[day] == nil {
                        results[day] = 0
                    }
                }
                continuation.resume(returning: results)
            }

            store.execute(query)
        }
    }

    private func dailySleepMinutes(start: Date, end: Date) async throws -> [Date: Double] {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [:] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let calendar = Calendar.current

        return try await withCheckedThrowingContinuation { continuation in
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { [weak self] _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let samples = samples as? [HKCategorySample] else {
                    continuation.resume(returning: [:])
                    return
                }

                var totals: [Date: Double] = [:]
                let asleepValues = self?.asleepCategoryValues() ?? []

                for sample in samples where asleepValues.contains(sample.value) {
                    var segmentStart = max(sample.startDate, start)
                    let segmentEndLimit = min(sample.endDate, end)

                    while segmentStart < segmentEndLimit {
                        let dayStart = calendar.startOfDay(for: segmentStart)
                        guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) else { break }
                        let currentSegmentEnd = min(dayEnd, segmentEndLimit)
                        let minutes = currentSegmentEnd.timeIntervalSince(segmentStart) / 60.0
                        if minutes > 0 {
                            totals[dayStart, default: 0] += minutes
                        }
                        segmentStart = currentSegmentEnd
                    }
                }

                continuation.resume(returning: totals)
            }

            self.store.execute(query)
        }
    }

    private func asleepCategoryValues() -> Set<Int> {
        var values: Set<Int> = [HKCategoryValueSleepAnalysis.asleep.rawValue]
        values.insert(HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue)
        if #available(iOS 16.0, *) {
            values.insert(HKCategoryValueSleepAnalysis.asleepCore.rawValue)
            values.insert(HKCategoryValueSleepAnalysis.asleepDeep.rawValue)
            values.insert(HKCategoryValueSleepAnalysis.asleepREM.rawValue)
        }
        return values
    }

    private func fetchQuantitySamples(_ id: HKQuantityTypeIdentifier, start: Date, end: Date, limit: Int) async throws -> [[String: Any]] {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { cont in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: limit, sortDescriptors: [sort]) { _, samples, error in
                if let error = error { return cont.resume(throwing: error) }
                let arr: [[String: Any]] = (samples as? [HKQuantitySample] ?? []).map { s in
                    [
                        "start": ISO8601DateFormatter().string(from: s.startDate),
                        "end": ISO8601DateFormatter().string(from: s.endDate),
                        "value": s.quantity.doubleValue(for: self.unit(for: id)),
                        "unit": self.unit(for: id).unitString
                    ]
                }
                cont.resume(returning: arr)
            }
            store.execute(q)
        }
    }

    private func unit(for id: HKQuantityTypeIdentifier) -> HKUnit {
        switch id {
        case .stepCount: return HKUnit.count()
        case .appleExerciseTime: return HKUnit.minute()
        case .activeEnergyBurned: return HKUnit.kilocalorie()
        case .distanceWalkingRunning: return HKUnit.meter()
        case .heartRate: return HKUnit.count().unitDivided(by: HKUnit.minute())
        default: return HKUnit.count()
        }
    }

    private func fetchWorkouts(start: Date, end: Date, limit: Int) async throws -> [[String: Any]] {
        let predicate = HKQuery.predicateForWorkouts(with: .greaterThanOrEqualTo, duration: 0)
        let datePredicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let combined = NSCompoundPredicate(andPredicateWithSubpredicates: [predicate, datePredicate])

        return try await withCheckedThrowingContinuation { cont in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let q = HKSampleQuery(sampleType: .workoutType(), predicate: combined, limit: limit, sortDescriptors: [sort]) { _, samples, error in
                if let error = error { return cont.resume(throwing: error) }
                let arr: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { w in
                    [
                        "activity": w.workoutActivityType.name,
                        "start": ISO8601DateFormatter().string(from: w.startDate),
                        "end": ISO8601DateFormatter().string(from: w.endDate),
                        "durationSec": w.duration,
                        "totalEnergyBurned_kcal": w.totalEnergyBurned?.doubleValue(for: .kilocalorie()),
                        "totalDistance_m": w.totalDistance?.doubleValue(for: .meter())
                    ]
                }
                cont.resume(returning: arr)
            }
            store.execute(q)
        }
    }

    private func fetchSleepSummary(start: Date, end: Date) async throws -> [String: Any] {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [:] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)

        let samples: [HKCategorySample] = try await withCheckedThrowingContinuation { cont in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: 2000, sortDescriptors: [sort]) { _, samples, error in
                if let error = error { return cont.resume(throwing: error) }
                cont.resume(returning: samples as? [HKCategorySample] ?? [])
            }
            store.execute(q)
        }

        let totalSec = samples.reduce(0.0) { acc, s in acc + s.endDate.timeIntervalSince(s.startDate) }
        let nights = Set(samples.map { Calendar.current.startOfDay(for: $0.startDate) }).count
        return [
            "nightsWithData": nights,
            "totalSleepSeconds": totalSec
        ]
    }
}

// Little helper to show workout type names
private extension HKWorkoutActivityType {
    var name: String {
        String(describing: self)
    }
}
