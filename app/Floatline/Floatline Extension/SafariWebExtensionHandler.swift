import SafariServices

/// Answers browser.runtime.sendNativeMessage calls from background.js.
/// The only request today is the caption size and language chosen in the
/// menu bar app.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let message = request?.userInfo?[SFExtensionMessageKey] as? [String: Any]

        var reply: [String: Any] = [:]
        if message?["type"] as? String == "getSettings" {
            reply["settings"] = [
                "captionScale": SharedSettings.captionScale,
                "language": SharedSettings.resolvedLanguage
            ]
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: reply]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
