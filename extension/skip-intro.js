(() => {
  "use strict";
  // MAIN world, document_start: observe page registrations before the player
  // installs its handlers. Keep this bridge separate from the isolated UI.
  if (window.FloatlineIntro) return;
  const session = navigator.mediaSession;
  const rawSet = session?.setActionHandler;
  let siteHandler = null;
  let owned = false;
  let unsupported = typeof rawSet !== "function";
  let error = "";
  let target = null;
  let cooldownUntil = 0;
  let skipped = 0;
  let timer;
  const labels = new Set([
    "skip intro", "skip introduction", "skip opening credits",
    "intro'yu atla", "introyu atla", "introyu gec", "jenerigi atla",
    "acilisi atla", "girisi atla", "giris kismini atla",
    "saltar intro", "saltar introduccion", "omitir intro", "omitir introduccion",
    "passer l'intro", "passer l'introduction", "ignorer l'introduction",
    "intro uberspringen", "vorspann uberspringen", "salta intro", "salta introduzione"
  ]);
  // Do not match generic "skip", ads, recaps, end credits or next episode.
  function normalize(text) {
    return (text || "").replace(/İ/g, "i").replace(/ı/g, "i")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
  }
  function elementsIn(scope, selector, result = []) {
    result.push(...scope.querySelectorAll(selector));
    for (const element of scope.querySelectorAll("*")) {
      if (element.id !== "floatline-controls" && element.shadowRoot)
        elementsIn(element.shadowRoot, selector, result);
    }
    return result;
  }
  function visible(element) {
    if (!element.isConnected || element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 ||
        rect.top >= innerHeight || rect.left >= innerWidth) return false;
    for (let node = element; node; node = node.parentElement || node.getRootNode()?.host) {
      if (node.id === "floatline-controls" || node.hidden || node.inert ||
          node.getAttribute("aria-hidden") === "true" || node.matches("dialog, [role=dialog], [role=menu]")) return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function findIntro() {
    return elementsIn(document, 'button, [role="button"], input[type="button"]').find(element => {
      if (!visible(element)) return false;
      return [element.innerText, element.getAttribute("aria-label"), element.getAttribute("title"), element.value]
        .some(label => labels.has(normalize(label)));
    }) || null;
  }
  function pipActive() {
    return elementsIn(document, "video").some(video => video.isConnected &&
      (video.webkitPresentationMode === "picture-in-picture" || document.pictureInPictureElement === video));
  }
  function restore() {
    if (!owned) return;
    try {
      rawSet.call(session, "skipad", siteHandler);
      owned = false;
    } catch (exception) { error = `${exception.name}: ${exception.message}`; }
  }
  function skip() {
    // The DOM can change between showing the native control and clicking it.
    const button = pipActive() && Date.now() >= cooldownUntil ? findIntro() : null;
    target = null;
    restore();
    if (!button) return;
    cooldownUntil = Date.now() + 2000;
    try {
      button.click();
      skipped++;
    } catch (exception) { error = `${exception.name}: ${exception.message}`; }
  }
  function sync() {
    if (unsupported) return;
    target = pipActive() && Date.now() >= cooldownUntil ? findIntro() : null;
    if (!target) return restore();
    if (owned) return;
    try {
      rawSet.call(session, "skipad", skip);
      owned = true;
      error = "";
    } catch (exception) {
      unsupported = true;
      error = `${exception.name}: ${exception.message}`;
    }
  }
  if (!unsupported) {
    try {
      session.setActionHandler = function (action, handler) {
        // Let native validation run first. Preserve later site registrations,
        // including removals, while our intro-only control temporarily owns it.
        const result = rawSet.call(this, action, handler);
        if (this === session && action === "skipad") {
          siteHandler = handler ?? null;
          if (owned) rawSet.call(session, "skipad", skip);
        }
        return result;
      };
    } catch (exception) {
      unsupported = true;
      error = `${exception.name}: ${exception.message}`;
    }
  }
  const events = ["webkitpresentationmodechanged", "enterpictureinpicture", "leavepictureinpicture"];
  for (const event of events) document.addEventListener(event, sync, true);
  // Poll also covers replacement controls and existing open shadow roots.
  // No automatic click: only the native user's skip action invokes skip().
  timer = setInterval(sync, 750);
  window.addEventListener("pagehide", () => { clearInterval(timer); target = null; restore(); });
  window.addEventListener("pageshow", event => {
    if (event.persisted) { clearInterval(timer); timer = setInterval(sync, 750); sync(); }
  });
  window.FloatlineIntro = {
    inspect: () => ({ version: "0.7.0", supported: !unsupported, registered: owned,
      detected: Boolean(target), label: target?.innerText || target?.getAttribute("aria-label") || "",
      skipped, error })
  };
})();
