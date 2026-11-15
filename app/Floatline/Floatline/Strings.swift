import Foundation

/// Menu bar texts in the supported languages. Keys missing in one language
/// fall back to English.
struct Strings {
    let language: String

    private static let table: [String: [String: String]] = [
        "tr": [
            "subtitle": "Altyazılı resim içinde resim",
            "safari": "Safari eklentisi",
            "on": "Açık",
            "off": "Kapalı",
            "unknown": "Bilinmiyor",
            "safariOnHint": "Video sayfalarında PiP düğmesi görünür.",
            "safariOffHint": "Kullanmak için Safari ayarlarından aç.",
            "openSettings": "Safari ayarları",
            "captions": "Altyazı",
            "size": "Boyut",
            "preview": "Bu konuşma PiP'te böyle görünecek.",
            "nextPip": "Bir sonraki PiP açılışında uygulanır.",
            "general": "Genel",
            "language": "Dil",
            "system": "Sistem",
            "launchAtLogin": "Oturum açılışında başlat",
            "hint": "Videoyu aç, sayfanın üstündeki PiP düğmesine bas.",
            "quit": "Çık",
            "loginError": "Ayar değiştirilemedi: %@"
        ],
        "en": [
            "subtitle": "Picture in Picture with captions",
            "safari": "Safari extension",
            "on": "On",
            "off": "Off",
            "unknown": "Unknown",
            "safariOnHint": "A PiP button appears on video pages.",
            "safariOffHint": "Turn it on in Safari settings to use it.",
            "openSettings": "Safari settings",
            "captions": "Captions",
            "size": "Size",
            "preview": "This is how dialogue looks in PiP.",
            "nextPip": "Applies the next time PiP opens.",
            "general": "General",
            "language": "Language",
            "system": "System",
            "launchAtLogin": "Open at login",
            "hint": "Play a video, then press the PiP button at the top of the page.",
            "quit": "Quit",
            "loginError": "Could not change the setting: %@"
        ]
    ]

    subscript(_ key: String) -> String {
        Strings.table[language]?[key] ?? Strings.table["en"]?[key] ?? key
    }

    func format(_ key: String, _ value: String) -> String {
        String(format: self[key], value)
    }
}
