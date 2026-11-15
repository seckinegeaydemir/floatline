(() => {
  "use strict";
  // User-facing strings of the in-page controls. The Floatline app can pick
  // the language; until it answers, follow the browser/system language.
  const strings = {
    tr: {
      pipOpen: "PiP aç",
      pipClose: "PiP kapat",
      noVideo: "Video bulunamadı. Önce videoyu başlat.",
      notReady: "Video henüz hazır değil. Oynatıp tekrar dene.",
      pipRequested: "PiP istendi.",
      pipOpened: "PiP açıldı.",
      pipUnsupported: "Bu video için Safari PiP desteği sunmuyor veya oynatıcı PiP'yi kapatmış.",
      pipFailed: "PiP açılamadı: {error}",
      captionStopped: "Altyazı aktarımı durdu: {error}"
    },
    en: {
      pipOpen: "Open PiP",
      pipClose: "Close PiP",
      noVideo: "No video found. Start the video first.",
      notReady: "The video is not ready yet. Play it and try again.",
      pipRequested: "PiP requested.",
      pipOpened: "PiP opened.",
      pipUnsupported: "Safari does not offer PiP for this video, or the player has turned PiP off.",
      pipFailed: "Could not open PiP: {error}",
      captionStopped: "Caption transfer stopped: {error}"
    }
  };

  function fromSystem() {
    const code = String(globalThis.navigator?.language || "en").toLowerCase();
    return code.startsWith("tr") ? "tr" : "en";
  }

  let language = fromSystem();

  function setLanguage(code) {
    language = strings[code] ? code : fromSystem();
  }

  function t(key, vars = {}) {
    const text = strings[language][key] ?? strings.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
  }

  window.FloatlineI18n = { t, setLanguage, get language() { return language; } };
})();
