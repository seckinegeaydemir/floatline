(() => {
  "use strict";
  const id = "floatline-controls";
  if (document.getElementById(id)) return;

  const host = document.createElement("div");
  host.id = id;
  host.style.cssText = "position:fixed;top:calc(16px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 24px)";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { font:12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
      color:white; color-scheme:dark; }
    .glass { background:linear-gradient(155deg,rgba(255,255,255,.19),rgba(255,255,255,.06) 55%,rgba(255,255,255,.12)),rgba(22,26,34,.55);
      -webkit-backdrop-filter:blur(24px) saturate(170%);
      backdrop-filter:blur(24px) saturate(170%);
      border:1px solid rgba(255,255,255,.26);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(255,255,255,.05),0 6px 24px rgba(0,0,0,.22); }
    .controls { display:flex;align-items:center;justify-content:center;gap:3px;
      width:max-content;max-width:100%;margin:auto;padding:4px;border-radius:999px; }
    button { color:rgba(255,255,255,.95);background:transparent;border:0;
      border-radius:999px;min-height:30px;padding:6px 12px;font:inherit;
      font-weight:500;white-space:nowrap;cursor:pointer;text-shadow:0 1px 3px rgba(0,0,0,.35);
      transition:background .15s ease,box-shadow .15s ease; }
    button:hover { background:rgba(255,255,255,.15);box-shadow:inset 0 1px 0 rgba(255,255,255,.15); }
    button:active { background:rgba(255,255,255,.22); }
    button:focus-visible { outline:2px solid rgba(255,255,255,.9);outline-offset:1px; }
    p { box-sizing:border-box;width:290px;max-width:calc(100vw - 24px);margin:8px auto 0;
      padding:10px 14px;border-radius:16px;line-height:1.5;white-space:pre-wrap;text-align:center; }
    p:empty { display:none; }
    [hidden] { display:none !important; }
    button { width:32px;height:30px;min-height:30px;padding:6px;display:grid;place-items:center;position:relative; }
    svg { width:18px;height:18px;display:block;pointer-events:none; }
    .tooltip { position:absolute;top:calc(100% + 12px);left:50%;transform:translateX(-50%);
      color:white;background:rgba(28,30,35,.92);border:1px solid rgba(255,255,255,.15);
      border-radius:7px;padding:5px 8px;white-space:nowrap;font-size:11px;font-weight:400;
      opacity:0;visibility:hidden;pointer-events:none; }
    button:hover .tooltip,button:focus-visible .tooltip { opacity:1;visibility:visible; }
    @media (prefers-reduced-motion:reduce) { button { transition:none; } }
  </style><div class="controls glass" role="group" aria-label="Floatline"><button type="button" id="pip" aria-label="PiP aç" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><rect x="12" y="12" width="7" height="6" rx="1.2" fill="currentColor" stroke="none"/></svg><span class="tooltip">PiP aç</span></button></div><p class="glass" role="status" aria-live="polite"></p>`;
  const button = root.querySelector("button");
  const status = root.querySelector("p");
  let current = null;
  let timer;
  const t = (key, vars) => window.FloatlineI18n.t(key, vars);
  function applyLabels() {
    const active = current?.webkitPresentationMode === "picture-in-picture" ||
      (current && document.pictureInPictureElement === current);
    const label = t(active ? "pipClose" : "pipOpen");
    button.setAttribute("aria-label", label);
    button.querySelector(".tooltip").textContent = label;
  }
  applyLabels();

  function say(message) {
    clearTimeout(timer);
    status.textContent = message;
    timer = setTimeout(() => { status.textContent = ""; }, 12000);
  }

  // Ask the Floatline app (through background.js) for caption size and language.
  // Failures keep the built-in default, so PiP never depends on the app.
  function loadSettings() {
    try {
      const api = globalThis.browser || globalThis.chrome;
      const reply = api?.runtime?.sendMessage?.({ type: "floatline-settings" });
      Promise.resolve(reply).then(settings => {
        if (settings && settings.captionScale != null) {
          window.FloatlineCaptions.setScale(settings.captionScale);
        }
        if (settings?.language) {
          window.FloatlineI18n.setLanguage(settings.language);
          applyLabels();
        }
      }).catch(() => {});
    } catch {}
  }
  loadSettings();

  function videosIn(scope) {
    const videos = [...scope.querySelectorAll("video")];
    for (const element of scope.querySelectorAll("*")) {
      if (element.shadowRoot) videos.push(...videosIn(element.shadowRoot));
    }
    return videos;
  }

  function selectVideo() {
    if (current?.isConnected && (current.webkitPresentationMode === "picture-in-picture" ||
        document.pictureInPictureElement === current)) return current;
    return videosIn(document).map(video => {
      const rect = video.getBoundingClientRect();
      const style = getComputedStyle(video);
      const area = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0)) *
        Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      return { video, area, playing: !video.paused && !video.ended,
        visible: area > 0 && style.display !== "none" && style.visibility !== "hidden" };
    }).filter(item => item.visible)
      .sort((a, b) => Number(b.playing) - Number(a.playing) || b.area - a.area)[0]?.video;
  }

  function watch(video) {
    window.FloatlinePlayback.attach(video);
    if (current === video) return;
    if (current) {
      current.removeEventListener("webkitpresentationmodechanged", update);
      current.removeEventListener("enterpictureinpicture", update);
      current.removeEventListener("leavepictureinpicture", update);
    }
    current = video;
    video.addEventListener("webkitpresentationmodechanged", update);
    video.addEventListener("enterpictureinpicture", update);
    video.addEventListener("leavepictureinpicture", update);
  }

  function update() {
    const active = current?.webkitPresentationMode === "picture-in-picture" ||
      (current && document.pictureInPictureElement === current);
    button.setAttribute("aria-pressed", String(Boolean(active)));
    applyLabels();
    if (active) {
      loadSettings();
      window.FloatlineCaptions.start(current, say);
    } else window.FloatlineCaptions.stop();
  }

  button.addEventListener("click", async () => {
    const video = selectVideo();
    if (!video) return say(t("noVideo"));
    watch(video);
    window.FloatlineCaptions.prepare(video);
    if (video.readyState === 0) return say(t("notReady"));
    try {
      // Call directly from this click to retain the user's activation.
      if (video.webkitPresentationMode === "picture-in-picture") {
        video.webkitSetPresentationMode("inline");
      } else if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else if (typeof video.webkitSetPresentationMode === "function" &&
          video.webkitSupportsPresentationMode?.("picture-in-picture")) {
        video.webkitSetPresentationMode("picture-in-picture");
        say(t("pipRequested"));
      } else if (document.pictureInPictureEnabled &&
          typeof video.requestPictureInPicture === "function" && !video.disablePictureInPicture) {
        await video.requestPictureInPicture();
        say(t("pipOpened"));
      } else {
        say(t("pipUnsupported"));
      }
      update();
    } catch (error) {
      say(t("pipFailed", { error: `${error.name}: ${error.message}` }));
    }
  });

  let scheduled = false;
  function refresh() {
    scheduled = false;
    if (!host.isConnected) document.documentElement.append(host);
    host.hidden = !videosIn(document).some(video => {
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }
  const observer = new MutationObserver(records => {
    if (scheduled || records.every(record => host.contains(record.target))) return;
    scheduled = true;
    setTimeout(refresh, 250);
  });
  refresh();
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // A new video inside an already-existing shadow root is not observable from
  // the outer document. Check periodically for player/navigation replacements.
  setInterval(() => { if (!scheduled) refresh(); }, 2000);
})();
