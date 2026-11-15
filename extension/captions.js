(() => {
  "use strict";
  let source = null;
  let locate = () => null;
  let captionBand = null;
  let picking = false;
  let notify = () => {};
  let onSelected = () => {};
  let session = null;
  let automatic = false;
  let sourceVideo = null;
  let lastSearch = 0;
  const diagnostic = { version: "1.0.0", state: "Kaynak seçilmedi", ticks: 0,
    sourceSelector: "", sourceText: "", cueText: "", videoTime: null,
    sourceChanges: 0, history: [], error: "" };
  const tracks = new WeakMap();
  const styleRoots = new WeakMap();
  const CUE_LINE = -4;
  // Caption size in percent; the Floatline menu bar app can change it.
  let captionScale = 80;
  const styleElements = new Set();

  function cueCss() {
    return `video[data-floatline-captions]::cue {
        background:transparent !important;background-color:transparent !important;
        font-size:${captionScale}% !important;color:white;
        text-shadow:0 1px 2px rgba(0,0,0,.85);
      }
      video[data-floatline-captions]::cue(.floatline) {
        background:transparent !important;background-color:transparent !important;
      }`;
  }

  function setScale(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    captionScale = Math.min(150, Math.max(50, Math.round(number)));
    for (const style of styleElements) {
      if (style.isConnected) style.textContent = cueCss();
      else styleElements.delete(style);
    }
  }

  function applyCaptionStyle(video) {
    const scope = video.getRootNode?.() || document;
    if (!styleRoots.has(scope)) {
      const style = document.createElement("style");
      style.textContent = cueCss();
      (scope.documentElement || scope).appendChild(style);
      styleRoots.set(scope, style);
      styleElements.add(style);
    }
    video.setAttribute("data-floatline-captions", "");
  }
  const excluded = "script,style,noscript,button,a,input,select,[role='dialog'],[role='menu'],[role='listbox'],[role='option'],#floatline-controls,#onetrust-consent-sdk";

  function belongsToControls(element) {
    for (let node = element; node; node = node.parentElement || node.getRootNode?.().host) {
      if (node.id === "floatline-controls") return true;
    }
    return false;
  }

  function active(video) {
    return video?.webkitPresentationMode === "picture-in-picture" ||
      (video && document.pictureInPictureElement === video);
  }

  function pathFor(element) {
    const parts = [];
    for (let node = element; node?.nodeType === 1; node = node.parentElement) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      // A ShadowRoot is a parentNode, but never a parentElement.
      const siblings = [...(node.parentNode?.children || node.parentElement?.children || [])]
        .filter(e => e.tagName === node.tagName);
      const index = siblings.indexOf(node);
      if (index < 0) throw new Error("Altyazı öğesinin kaynak yolu oluşturulamadı.");
      parts.unshift(`${node.localName}:nth-of-type(${index + 1})`);
    }
    return parts.join(" > ");
  }

  function locatorFor(element) {
    const originalRoot = element.getRootNode();
    const selector = pathFor(element);
    if (!originalRoot.host) {
      return { label: selector, find: () => originalRoot.querySelector(selector) };
    }
    const originalHost = originalRoot.host;
    const hostLocator = locatorFor(originalHost);
    return {
      label: `${hostLocator.label} → shadow → ${selector}`,
      find() {
        const host = hostLocator.find();
        const root = host?.shadowRoot || (host === originalHost && host.isConnected ? originalRoot : null);
        return root?.querySelector(selector) || null;
      }
    };
  }

  function setSource(element, auto = false) {
    // DxcOverlay was observed in this Disney+ player. Prefer its complete
    // caption region when the selected text belongs to it.
    const overlay = element.closest(".DxcOverlay");
    const paragraph = element.closest("p");
    source = overlay || (paragraph?.textContent.length <= 500 ? paragraph : element);
    // Keep the surrounding region, not the particular sentence node. Disney+
    // can replace/retain individual sentence nodes between caption updates.
    let region = auto ? element : overlay || source.parentElement || source;
    const scope = source.getRootNode();
    if (scope.host && !auto) {
      // Follow the top-level caption area, not a single sentence's span.
      region = source;
      while (region.parentElement) region = region.parentElement;
    }
    const locator = locatorFor(region);
    diagnostic.sourceSelector = locator.label;
    diagnostic.state = "Kaynak seçildi";
    const box = region.getBoundingClientRect();
    const textBox = source.getBoundingClientRect();
    captionBand = !auto && !overlay && box.height > 0 ? {
      top: (textBox.top - box.top - textBox.height) / box.height,
      bottom: (textBox.bottom - box.top + textBox.height) / box.height
    } : null;
    // Re-query even if the old region is still connected, as it may be stale.
    locate = () => locator.find();
    automatic = auto;
    if (!auto) {
      notify(`Yakalanan yazı: “${source.textContent.trim().slice(0, 120)}”\nPiP'de bu konuşma yazısı gösterilecek.`);
      onSelected();
    }
  }

  function discover(video, force = false) {
    if (picking || (source && !automatic)) return;
    if (!force && Date.now() - lastSearch < 1000) return;
    lastSearch = Date.now();
    const element = window.FloatlineAutoCaptions?.find(video);
    if (element) { setSource(element, true); sourceVideo = video; }
  }

  function selected(event) {
    if (!picking) return;
    const path = event.composedPath();
    const target = path.find(e => e instanceof Element);
    if (!target || path.some(e => e.id === "floatline-controls") || belongsToControls(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Captions may have pointer-events:none. Find the rendered text at the
    // click position rather than requiring it to receive the click itself.
    const element = textAtPoint(event.clientX, event.clientY);
    const text = element?.textContent?.trim();
    if (!text || text.length > 500 || belongsToControls(element) || element.closest(excluded)) {
      notify("Dil ayarını kapat; videonun altında görünen konuşma yazısının üzerine tıkla. Esc ile iptal.");
      return;
    }
    picking = false;
    removePicker();
    setSource(element);
    tick();
  }

  function captionText(region) {
    const box = region.getBoundingClientRect();
    const top = captionBand ? box.top + captionBand.top * box.height : box.top;
    const bottom = captionBand ? box.top + captionBand.bottom * box.height : box.bottom;
    const fragments = [];
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      const text = node.textContent.trim();
      if (!text || !element || belongsToControls(element) || element.closest(excluded + ",video")) continue;
      let visible = true;
      for (let parent = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
          visible = false;
          break;
        }
        if (parent === region) break;
      }
      if (!visible) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0 &&
        r.bottom > top && r.top < bottom && r.right > box.left && r.left < box.right);
      if (rect) fragments.push({ text, rect });
    }
    fragments.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    let text = "";
    let previous;
    for (const fragment of fragments) {
      if (text) text += previous && fragment.rect.top - previous.rect.top > previous.rect.height * 0.5 ? "\n" : " ";
      text += fragment.text;
      previous = fragment;
    }
    return text;
  }

  function textAtPoint(x, y) {
    const matches = [];
    function scan(scope) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const element = node.parentElement;
        if (!node.textContent.trim() || !element ||
            belongsToControls(element) || element.closest(excluded)) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            matches.push({ element, area: rect.width * rect.height });
            break;
          }
        }
      }
      for (const element of scope.querySelectorAll("*")) {
        if (element.shadowRoot && element.id !== "floatline-controls") scan(element.shadowRoot);
      }
    }
    scan(document.body);
    return matches.sort((a, b) => a.area - b.area)[0]?.element;
  }

  function escape(event) {
    if (event.key !== "Escape") return;
    picking = false;
    removePicker();
    notify("Altyazı seçimi iptal edildi.");
  }

  function removePicker() {
    document.removeEventListener("click", selected, true);
    document.removeEventListener("keydown", escape, true);
  }

  function clear(track) {
    for (const cue of [...(track.cues || [])]) track.removeCue(cue);
  }

  function stop() {
    if (!session) return;
    clearInterval(session.timer);
    session.video.removeEventListener("timeupdate", tick);
    session.video.removeEventListener("seeking", tick);
    session.video.removeEventListener("webkitpresentationmodechanged", modeChanged);
    session.video.removeEventListener("leavepictureinpicture", modeChanged);
    session.track.mode = "disabled";
    session.video.removeAttribute("data-floatline-captions");
    clear(session.track);
    session = null;
    diagnostic.state = "Aktarım durdu";
    diagnostic.cueText = "";
  }

  function modeChanged() {
    if (session && !active(session.video)) stop();
  }

  function tick() {
    if (!session) return;
    const { video, track } = session;
    diagnostic.ticks++;
    diagnostic.videoTime = Number(video.currentTime.toFixed(2));
    if (!video.isConnected || !active(video)) return stop();
    try {
      let element = locate();
      if (!element || automatic) {
        discover(video);
        element = locate();
      }
      if (element && belongsToControls(element)) {
        stop();
        source = null;
        return;
      }
      const text = element ? captionText(element) : "";
      diagnostic.state = element ? (automatic ? "Otomatik altyazı aktarılıyor" : "Aktarım çalışıyor") : "Altyazı otomatik aranıyor";
      if (text !== diagnostic.sourceText) {
        diagnostic.sourceChanges++;
        diagnostic.history.push({ time: diagnostic.videoTime, text: text.slice(0, 150) });
        if (diagnostic.history.length > 8) diagnostic.history.shift();
      }
      diagnostic.sourceText = text;
      // Safari renders this native TextTrack; the original DRM video is intact.
      track.mode = "showing";
      if (text && text.length <= 500 && element.getClientRects().length &&
          getComputedStyle(element).visibility !== "hidden" &&
          getComputedStyle(element).display !== "none") {
        const escaped = `<c.floatline>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</c>`;
        const cue = track.cues?.[0];
        if (cue?.text === escaped && video.currentTime >= cue.startTime &&
            video.currentTime <= cue.endTime) {
          cue.endTime = video.currentTime + 1;
        } else {
          track.mode = "hidden";
          clear(track);
          const next = new VTTCue(Math.max(0, video.currentTime - 0.1), video.currentTime + 1, escaped);
          // Native PiP draws its control bar over the bottom ~3 lines.
          // -2 was hidden behind it on Netflix; -4 keeps text above the bar.
          next.line = CUE_LINE;
          track.addCue(next);
          track.mode = "showing";
        }
      } else {
        track.mode = "hidden";
        clear(track);
      }
      diagnostic.cueText = track.cues?.[0]?.text || "";
    } catch (error) {
      stop();
      diagnostic.error = `${error.name}: ${error.message}`;
      notify(window.FloatlineI18n?.t("captionStopped", { error: error.message }) ??
        `Altyazı aktarımı durdu: ${error.message}`);
    }
  }

  window.FloatlineCaptions = {
    setScale,
    pick(callback, selectedCallback = () => {}) {
      stop();
      source = null;
      sourceVideo = null;
      automatic = false;
      locate = () => null;
      captionBand = null;
      Object.assign(diagnostic, { state: "Yazı seçimi bekleniyor", ticks: 0,
        sourceSelector: "", sourceText: "", cueText: "", sourceChanges: 0, history: [], error: "" });
      notify = callback;
      onSelected = selectedCallback;
      picking = true;
      removePicker();
      document.addEventListener("click", selected, true);
      document.addEventListener("keydown", escape, true);
      notify("Dil ayarını kapat; videonun altında görünen konuşma yazısının üzerine tıkla. Esc ile iptal.");
    },
    start(video, callback) {
      notify = callback;
      if (sourceVideo && sourceVideo !== video) { source = null; locate = () => null; automatic = false; }
      sourceVideo = video;
      if (!source) {
        // Some services expose real enabled HTML text tracks. Safari can render
        // these directly; keep the service's existing selection intact.
        const nativeTrack = [...(video.textTracks || [])].find(track =>
          track.mode === "showing" && (track.kind === "subtitles" || track.kind === "captions") &&
          track !== tracks.get(video));
        if (nativeTrack) {
          diagnostic.state = "Oynatıcının yerel altyazısı kullanılıyor";
          return;
        }
        discover(video, true);
      }
      if (picking) return;
      if (session?.video === video) return;
      stop();
      applyCaptionStyle(video);
      let track = tracks.get(video);
      if (!track) {
        track = video.addTextTrack("subtitles", "Floatline", "");
        tracks.set(video, track);
      }
      session = { video, track, timer: setInterval(tick, 100) };
      video.addEventListener("timeupdate", tick);
      video.addEventListener("seeking", tick);
      video.addEventListener("webkitpresentationmodechanged", modeChanged);
      video.addEventListener("leavepictureinpicture", modeChanged);
      tick();
    },
    prepare(video) {
      if (sourceVideo && sourceVideo !== video) { source = null; locate = () => null; automatic = false; }
      sourceVideo = video;
      discover(video, true);
    },
    stop,
    inspect() { return JSON.parse(JSON.stringify(diagnostic)); }
  };
})();
