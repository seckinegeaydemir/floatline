const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(`${__dirname}/../extension/i18n.js`, "utf8");

function load(language) {
  const window = {};
  vm.runInNewContext(source, { window, globalThis: { navigator: { language } }, String });
  return window.FloatlineI18n;
}

// Default follows the system/browser language.
assert.equal(load("tr-TR").language, "tr");
assert.equal(load("en-GB").language, "en");
assert.equal(load("de-DE").language, "en", "Unsupported languages fall back to English");

// The app's choice overrides; unknown codes return to the system default.
const i18n = load("tr-TR");
assert.equal(i18n.t("pipOpen"), "PiP aç");
i18n.setLanguage("en");
assert.equal(i18n.t("pipOpen"), "Open PiP");
assert.equal(i18n.t("pipFailed", { error: "NotAllowedError: x" }), "Could not open PiP: NotAllowedError: x");
i18n.setLanguage("system");
assert.equal(i18n.language, "tr");

// Every key exists in both languages.
const both = load("en");
for (const code of ["tr", "en"]) {
  both.setLanguage(code);
  for (const key of ["pipOpen", "pipClose", "noVideo", "notReady", "pipRequested", "pipOpened", "pipUnsupported", "pipFailed", "captionStopped"]) {
    assert.notEqual(both.t(key), key, `${code} is missing ${key}`);
  }
}
console.log("Language default, override and key coverage passed.");
