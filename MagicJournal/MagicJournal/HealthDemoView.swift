import SwiftUI

struct HealthDemoView: View {
    @State private var exportedJSON: String = ""
    @State private var errorMessage: String?
    @State private var isAuthorizing = false
    @State private var isExporting = false

    var body: some View {
        VStack(spacing: 20) {
            Text("HealthKit Demo")
                .font(.title)
                .fontWeight(.semibold)
            if !HealthKitManager.shared.isHealthDataAvailable {
                Text("Health data is not available on this device (e.g., Simulator). Please run on a real iPhone.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Button(isAuthorizing ? "Authorizing…" : "Request Access (Steps, HR, Energy, Distance, Sleep, Workouts)") {
                Task {
                    isAuthorizing = true
                    defer { isAuthorizing = false }
                    do {
                        try await HealthKitManager.shared.requestAuthorization()
                        errorMessage = nil
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isAuthorizing || !HealthKitManager.shared.isHealthDataAvailable)

            Button(isExporting ? "Exporting…" : "Export Last 14 Days to JSON") {
                Task {
                    isExporting = true
                    defer { isExporting = false }
                    do {
                        let json = try await HealthKitManager.shared.exportHealthDataJSON(forPastDays: 14)
                        exportedJSON = json
                        errorMessage = nil
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            .buttonStyle(.bordered)
            .disabled(isExporting || !HealthKitManager.shared.isHealthDataAvailable)

            ScrollView {
                if exportedJSON.isEmpty {
                    Text("The exported JSON will appear here once available.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Text(exportedJSON)
                        .font(.system(.body, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxHeight: 240)
            .padding(12)
            .background(Color.secondary.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            if let errorMessage {
                Text("Error: \(errorMessage)")
                    .foregroundStyle(.red)
            }
        }
        .padding()
    }
}

#Preview {
    HealthDemoView()
}
