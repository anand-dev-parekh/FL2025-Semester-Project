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

    // MARK: - Helpers

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
            HKHealthStore().execute(q)
        }
    }

    private func unit(for id: HKQuantityTypeIdentifier) -> HKUnit {
        switch id {
        case .stepCount: return HKUnit.count()
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
            HKHealthStore().execute(q)
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
            HKHealthStore().execute(q)
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
