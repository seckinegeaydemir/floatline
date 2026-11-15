import SwiftUI
import Combine
import SafariServices
import ServiceManagement

let extensionBundleIdentifier = "com.floatline.Floatline.Extension"

@main
struct FloatlineApp: App {
    @StateObject private var model = MenuModel()

    var body: some Scene {
        MenuBarExtra {
            MenuView(model: model)
        } label: {
            Image("MenuBarIcon")
                .accessibilityLabel("Floatline")
        }
        .menuBarExtraStyle(.window)
    }
}

@MainActor
final class MenuModel: ObservableObject {
    enum ExtensionState {
        case unknown, enabled, disabled
    }

    @Published var extensionState: ExtensionState = .unknown
    @Published var launchAtLogin = SMAppService.mainApp.status == .enabled
    @Published var launchAtLoginError: String?
    @Published var captionScale = Double(SharedSettings.captionScale) {
        didSet { SharedSettings.captionScale = Int(captionScale) }
    }
    /// "system", "tr" or "en"; the extension reads the resolved value.
    @Published var language = SharedSettings.language {
        didSet { SharedSettings.language = language }
    }

    var strings: Strings { Strings(language: SharedSettings.resolvedLanguage) }

    func refresh() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [weak self] state, _ in
            let enabled = state?.isEnabled
            Task { @MainActor in
                guard let self else { return }
                switch enabled {
                case true?: self.extensionState = .enabled
                case false?: self.extensionState = .disabled
                case nil: self.extensionState = .unknown
                }
            }
        }
        launchAtLogin = SMAppService.mainApp.status == .enabled
    }

    func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in }
    }

    func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            launchAtLoginError = nil
        } catch {
            launchAtLoginError = error.localizedDescription
        }
        launchAtLogin = SMAppService.mainApp.status == .enabled
    }
}
