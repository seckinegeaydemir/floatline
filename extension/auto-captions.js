(() => {
  "use strict";
  // Require a caption-specific name; geometry alone can pick titles or controls.
  const selector = '.DxcOverlay,.player-timedtext,.ytp-caption-window-container,' +
    '[class*="subtitle" i],[id*="subtitle" i],[class*="caption" i],[id*="caption" i],' +
    '[class*="timedtext" i],[class*="ttml" i],[data-testid*="subtitle" i],[data-testid*="caption" i]';
  const excluded = 'button,a,input,select,script,style,[role="button"],[role="dialog"],' +
    '[role="menu"],[role="listbox"],[role="option"],#floatline-controls';
  function parents(element) {
    const result = [];
    for (let node = element; node; node = node.parentElement || node.getRootNode()?.host) result.push(node);
    return result;
  }
  function usable(element) {
    return element.isConnected && !parents(element).some(node => {
      const style = getComputedStyle(node);
      return node.matches(excluded) || node.hidden || node.getAttribute("aria-hidden") === "true" ||
        style.display === "none" || style.visibility !== "visible" || style.opacity === "0";
    });
  }
  function textIn(region) {
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() && node.parentElement && usable(node.parentElement)) parts.push(node.textContent.trim());
      if (parts.join(" ").length > 500) return "";
    }
    return parts.join(" ");
  }
  function find(video) {
    const videoBox = video.getBoundingClientRect();
    if (videoBox.width <= 0 || videoBox.height <= 0) return null;
    const candidates = [];
    function consider(element) {
      if (!usable(element)) return;
      const box = element.getBoundingClientRect();
      // Named wrappers often cover the entire player. Their rendered text must
      // still be visible inside this video, rather than in a language menu.
      if (box.width <= 0 || box.height <= 0 || box.right <= videoBox.left || box.left >= videoBox.right ||
          box.bottom <= videoBox.top || box.top >= videoBox.bottom) return;
      const text = textIn(element);
      if (!text || text.length > 500) return;
      const words = text.toLocaleLowerCase().trim();
      if (/^(subtitles?|captions?|closed captions?|altyaz[iı](lar)?|off|on|kapal[iı]|aç[iı]k|türkçe|english)$/.test(words)) return;
      const known = element.matches('.DxcOverlay,.player-timedtext,.ytp-caption-window-container');
      candidates.push({ element, score: (known ? 100 : 0) +
        (box.top >= videoBox.top + videoBox.height * .45 ? 20 : 0) - box.width * box.height / (videoBox.width * videoBox.height) });
    }
    function scan(scope) {
      for (const element of scope.querySelectorAll(selector)) consider(element);
      for (const element of scope.querySelectorAll("*")) {
        if (!element.shadowRoot || element.id === "floatline-controls") continue;
        // Disney+ can keep unnamed caption nodes in a named shadow host.
        if (element.matches(selector)) for (const child of element.shadowRoot.children) consider(child);
        scan(element.shadowRoot);
      }
    }
    scan(document);
    return candidates.sort((a, b) => b.score - a.score)[0]?.element || null;
  }
  window.FloatlineAutoCaptions = { find };
})();
