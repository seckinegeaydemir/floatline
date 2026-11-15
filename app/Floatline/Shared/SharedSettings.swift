import Foundation

/// Settings shared between the Floatline menu bar app and its Safari extension.
/// Both targets carry the same App Group entitlement, so they read one store.
enum SharedSettings {
    nonisolated static let appGroup = "6N83C75M3J.com.floatline.shared"
    nonisolated static let captionScaleKey = "captionScale"
    nonisolated static let languageKey = "language"
    nonisolated static let defaultCaptionScale = 80
    nonisolated static let captionScaleRange = 50...150
    /// "system" follows the Mac's preferred language; otherwise a fixed code.
    nonisolated static let languageChoices = ["system", "tr", "en"]

    nonisolated static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }

    /// Caption size in percent of Safari's default cue size.
    nonisolated static var captionScale: Int {
        get {
            let stored = defaults.integer(forKey: captionScaleKey)
            guard stored != 0 else { return defaultCaptionScale }
            return min(max(stored, captionScaleRange.lowerBound), captionScaleRange.upperBound)
        }
        set {
            defaults.set(newValue, forKey: captionScaleKey)
        }
    }

    nonisolated static var language: String {
        get {
            let stored = defaults.string(forKey: languageKey) ?? "system"
            return languageChoices.contains(stored) ? stored : "system"
        }
        set {
            defaults.set(newValue, forKey: languageKey)
        }
    }

    /// The language actually shown: "tr" or "en". Unsupported system
    /// languages fall back to English.
    nonisolated static var resolvedLanguage: String {
        if language != "system" { return language }
        let preferred = Locale.preferredLanguages.first?.lowercased() ?? "en"
        return preferred.hasPrefix("tr") ? "tr" : "en"
    }
}
