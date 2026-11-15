<p align="center">
  <img src="design/app-icon-1024.png" width="128" height="128" alt="Floatline icon">
</p>

<h1 align="center">Floatline</h1>

<p align="center">Picture in Picture with captions for Safari on macOS.</p>

Floatline is a small macOS menu bar app with a Safari Web Extension. On a video page it adds a PiP button. Pressing it moves the video into Safari's native Picture in Picture window and brings the subtitles you see on the page along with it.

## Features

- **One-click PiP**: a small glass button at the top of any page with an HTML5 video.
- **Captions in PiP**: Floatline finds the visible subtitle text on the page and mirrors it into the PiP window. If the player already exposes a native text track, Floatline uses that instead.
- **Captions above the controls**: subtitles sit above the PiP control bar instead of behind it.
- **Caption size**: choose 50–150 % in the menu bar app, with a live preview.
- **Languages**: English and Turkish. By default Floatline follows your Mac's language; you can override it in the menu bar app.
- **Skip intro (experimental)**: on supported services, while an intro's "Skip" button is on screen, Safari's PiP may offer a skip control that presses that button.
- **Private**: Floatline sends no data anywhere. Caption text never leaves your Mac.

## Compatibility

| Service | Status |
| --- | --- |
| Disney+ | Tested: PiP and captions |
| Netflix | Tested: PiP and captions |
| Prime Video, Apple TV+, others | Not tested yet |

Requirements: macOS 14 or later, Safari with the extension turned on and allowed on the site.

## Known limitations

- **No scrubbing from the PiP window.** On macOS, Safari's PiP time bar is display only. WebKit has no seek path from it (see `VideoPresentationInterfaceMac.mm`), so dragging it does nothing.
- **Captions must be on in the player.** Floatline reads the subtitles the site already draws. Turn on the subtitle language in the player first.
- **Some captions cannot be read.** Subtitles drawn into a canvas or image, inside closed shadow roots, or in inaccessible iframes are out of reach.
- **Safari controls the look.** Safari and the macOS caption accessibility settings can override font and background.

## Install from source

You need Xcode 27 or later and an Apple Development certificate.

1. Clone the repository and open `app/Floatline/Floatline.xcodeproj`.
2. Use your own Apple developer team:
   - In **Signing & Capabilities**, choose your team for the **Floatline** and **Floatline Extension** targets.
   - Replace the team prefix `6N83C75M3J` in the App Group ID with your own Team ID in these three files:
     - `app/Floatline/Floatline/Floatline.entitlements`
     - `app/Floatline/Floatline Extension/Floatline_Extension.entitlements`
     - `app/Floatline/Shared/SharedSettings.swift`
3. Build the **Floatline** scheme in the Release configuration and copy `Floatline.app` to `/Applications`.
4. Open Floatline once. In Safari, go to **Settings → Extensions**, turn on **Floatline**, and allow it on your video sites.

Building from the command line:

```bash
cd app/Floatline
xcodebuild -project Floatline.xcodeproj -scheme Floatline -configuration Release -derivedDataPath ../build.noindex build
```

The `.noindex` suffix keeps Spotlight from indexing the build. Otherwise Safari can list a second copy of the extension.

## Usage

1. Play a video and turn on subtitles in the player.
2. Press the PiP button at the top of the page.
3. Floatline looks for the subtitles on the page. If no one is speaking yet, it keeps looking while PiP is open.
4. Press the button again to bring the video back to the page.

Open the menu bar icon to check that the extension is on, change caption size or language, and choose whether Floatline opens at login.

## How it works

- **The page script** (`extension/content.js`) finds the largest playing video and asks Safari for native PiP. It calls PiP directly from your click, because Safari only allows PiP after a user action.
- **Caption mirroring** (`extension/auto-captions.js`, `extension/captions.js`) finds the subtitle region near the video, including open shadow roots. It copies the text into a `VTTCue` on a hidden text track, which Safari then draws in the PiP window.
- **Settings** go from the menu bar app to the extension through a shared App Group. `background.js` asks the native handler (`SafariWebExtensionHandler.swift`) for them with `browser.runtime.sendNativeMessage`.

## Project structure

```
app/Floatline/        Xcode project: menu bar app (SwiftUI) and Safari extension target
  Floatline/          Menu bar app
  Floatline Extension/  Native handler that answers the extension's settings requests
  Shared/             Settings shared by both targets (App Group)
extension/            Web extension source; the Xcode project uses these files directly
tests/                Dependency-free Node tests for the extension scripts
design/               Icon sources (explorations/ keeps earlier drafts)
```

## Tests

```bash
npm test
```

The tests use only Node's built-in modules. They cover caption discovery and transfer, cue placement, the caption size setting, language fallback, the skip-intro bridge and playback position reporting. They do not cover Safari's native PiP rendering, so test real playback in Safari by hand.

## Disclaimer

Floatline is an independent project. It is not affiliated with or endorsed by Apple, Netflix, Disney or any streaming service. Their names appear only to describe compatibility.

## License

[MIT](LICENSE)
