import SwiftUI
import UIKit

struct HealthDemoView: View {
    @EnvironmentObject private var session: SessionController
    @State private var summaries: [HealthDailySummary] = []
    @State private var isRequestingAccess = false
    @State private var isRefreshing = false
    @State private var isSyncing = false
    @State private var hasPermissions = HealthKitManager.shared.isHealthDataAvailable
    @State private var lastSyncedAt: Date?
    @State private var errorMessage: String?
    @State private var successMessage: String?

    private let manager = HealthKitManager.shared
    private let apiClient = APIClient.shared
    private let lookbackDays = 7

    private var isBusy: Bool {
        isRequestingAccess || isRefreshing || isSyncing
    }

    private var summaryMetrics: (averageSteps: Int, averageExercise: Int, averageSleepHours: Double)? {
        guard !summaries.isEmpty else { return nil }
        let totals = summaries.reduce(into: (steps: 0, exercise: 0, sleep: 0)) { result, summary in
            result.steps += summary.steps
            result.exercise += summary.exerciseMinutes
            result.sleep += summary.sleepMinutes
        }
        let count = Double(summaries.count)
        guard count > 0 else { return nil }
        return (
            averageSteps: Int((Double(totals.steps) / count).rounded()),
            averageExercise: Int((Double(totals.exercise) / count).rounded()),
            averageSleepHours: (Double(totals.sleep) / count) / 60.0
        )
    }

    private var lastSyncedDescription: String {
        guard let lastSyncedAt else { return "Never synced" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: lastSyncedAt, relativeTo: Date())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Health Sync")
                        .font(.title)
                        .fontWeight(.semibold)
                    Text("Import your daily steps, exercise minutes, and sleep from Apple Health.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Text("Last synced: \(lastSyncedDescription)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !manager.isHealthDataAvailable {
                    unavailableView
                } else {
                    authorizationView
                    actionsView
                    statusView
                    if hasPermissions {
                        summaryView
                        dataListView
                    } else {
                        permissionsReminderView
                    }
                }
            }
            .padding(.vertical, 32)
            .padding(.horizontal, 24)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .onAppear {
            let allowed = refreshAuthorizationState()
            if allowed {
                loadSummaries()
            }
        }
    }

    private var unavailableView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Health data is not available on this device.")
                .font(.headline)
            Text("Please run Magic Journal on a physical iPhone to access HealthKit.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var authorizationView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Apple Health Access")
                .font(.headline)
            Text(
                hasPermissions
                ? "You're all set. You can refresh or sync your Health data below."
                : "We need permission to read your activity data from Apple Health."
            )
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button {
                requestAuthorization()
            } label: {
                Label(
                    hasPermissions ? "Recheck Permissions" : "Grant Health Access",
                    systemImage: hasPermissions ? "checkmark.shield" : "heart.fill"
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRequestingAccess)

        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var actionsView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Daily Insights")
                .font(.headline)

            HStack(spacing: 12) {
                Button {
                    loadSummaries()
                } label: {
                    Label(isRefreshing ? "Refreshing…" : "Refresh Data", systemImage: "arrow.clockwise.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isRefreshing || isSyncing)

                Button {
                    syncToBackend()
                } label: {
                    Label(isSyncing ? "Syncing…" : "Sync Data", systemImage: "icloud.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isBusy || session.user == nil)
            }

            if session.user == nil {
                Text("Sign in to sync your Health data with Magic Journal.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var statusView: some View {
        Group {
            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else if let successMessage {
                Label(successMessage, systemImage: "checkmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(.green)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else if isSyncing {
                Label("Syncing with Magic Journal…", systemImage: "arrow.triangle.2.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if isRefreshing {
                Label("Fetching the latest data from Apple Health…", systemImage: "arrow.triangle.2.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var summaryView: some View {
        Group {
            if let summaryMetrics {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Last \(lookbackDays)-day averages")
                        .font(.headline)
                    HStack(spacing: 16) {
                        summaryCard(
                            title: "Steps",
                            value: summaryMetrics.averageSteps.formatted(),
                            subtitle: "per day"
                        )
                        summaryCard(
                            title: "Exercise",
                            value: summaryMetrics.averageExercise.formatted(),
                            subtitle: "minutes daily"
                        )
                        summaryCard(
                            title: "Sleep",
                            value: summaryMetrics.averageSleepHours.formatted(.number.precision(.fractionLength(1))),
                            subtitle: "hours nightly"
                        )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding()
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }

    private func summaryCard(title: String, value: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2)
                .fontWeight(.semibold)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var dataListView: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Daily totals")
                .font(.headline)
            if summaries.isEmpty {
                Text("We couldn’t find any Health data for the last \(lookbackDays) days.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(summaries) { summary in
                    VStack(spacing: 12) {
                        HStack {
                            Text(summary.displayDate)
                                .font(.headline)
                            Spacer()
                            Label("\(summary.steps.formatted()) steps", systemImage: "figure.walk")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        HStack {
                            Label("\(summary.exerciseMinutes) min exercise", systemImage: "bolt.heart")
                            Spacer()
                            Label(
                                "\(sleepHoursString(for: summary)) hrs sleep",
                                systemImage: "bed.double.fill"
                            )
                        }
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color(.secondarySystemGroupedBackground))
                    )
                }
            }
        }
    }

    private var permissionsReminderView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Health permissions needed")
                .font(.headline)
            Text("Open the Health app → Sources → Magic Journal to update sharing settings.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func sleepHoursString(for summary: HealthDailySummary) -> String {
        let hours = Double(summary.sleepMinutes) / 60.0
        return hours.formatted(.number.precision(.fractionLength(1)))
    }

    @MainActor
    @discardableResult
    private func refreshAuthorizationState() -> Bool {
        let available = manager.isHealthDataAvailable
        hasPermissions = available
        #if DEBUG
        print("[HealthSync] Health data available:", available)
        #endif
        return available
    }

    private func requestAuthorization() {
        Task {
            await MainActor.run {
                isRequestingAccess = true
                errorMessage = nil
                successMessage = nil
            }

            do {
                try await manager.requestAuthorization()
                let granted = await MainActor.run { refreshAuthorizationState() }
                if granted {
                    loadSummaries()
                } else {
                    await MainActor.run {
                        errorMessage = "Please enable Health sharing in the Health app to sync data."
                        successMessage = nil
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }

            await MainActor.run {
                isRequestingAccess = false
            }
        }
    }

    private func loadSummaries() {
        let available = refreshAuthorizationState()
        guard available else {
            errorMessage = "Health data isn't available on this device."
            successMessage = nil
            return
        }
        Task {
            await MainActor.run {
                isRefreshing = true
                errorMessage = nil
                successMessage = nil
            }

            do {
                let latest = try await manager.fetchDailySummaries(forPastDays: lookbackDays)
                await MainActor.run {
                    summaries = latest
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    summaries = []
                }
            }

            await MainActor.run {
                isRefreshing = false
            }
        }
    }

    private func syncToBackend() {
        let available = refreshAuthorizationState()
        guard available else {
            errorMessage = "Health data isn't available on this device."
            successMessage = nil
            return
        }
        guard session.user != nil else {
            errorMessage = "You must be signed in to sync Health data."
            successMessage = nil
            return
        }

        Task {
            await MainActor.run {
                isSyncing = true
                errorMessage = nil
                successMessage = nil
            }

            do {
                let latest = try await manager.fetchDailySummaries(forPastDays: lookbackDays)
                await MainActor.run {
                    summaries = latest
                }

                guard !latest.isEmpty else {
                    await MainActor.run {
                        errorMessage = "No recent Health data found to sync."
                        successMessage = nil
                    }
                    return
                }

                #if DEBUG
                print("[HealthSync] Uploading \(latest.count) day(s) of summaries")
                #endif

                try await apiClient.uploadHealthSummaries(latest)

                await MainActor.run {
                    lastSyncedAt = Date()
                    successMessage = "Synced \(latest.count) day\(latest.count == 1 ? "" : "s") of Health data."
                }
            } catch {
                await MainActor.run {
                    if case let APIError.httpError(status, message) = error, status == 401 {
                        errorMessage = message.isEmpty ? "Session expired. Please sign in again before syncing." : message
                    } else {
                        errorMessage = error.localizedDescription
                    }
                    successMessage = nil
                }
            }

            await MainActor.run {
                isSyncing = false
            }
        }
    }

}

#Preview {
    HealthDemoView()
        .environmentObject(SessionController(apiClient: .shared))
}
