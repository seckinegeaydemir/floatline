const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const document = scope([]);
function scope(elements) {
  return { children: elements, querySelectorAll: selector => selector === "*" ? elements : elements.filter(e => e.named) };
}
function element(text, { named = true, known = false, control = false, top = 400 } = {}) {
  const result = { textContent: text, named, known, control, isConnected: true,
    style: { display: "block", visibility: "visible", opacity: "1" },
    getAttribute: () => null, getRootNode: () => document,
    matches(selector) { return selector.startsWith("button,") ? this.control : selector === '.DxcOverlay,.player-timedtext,.ytp-caption-window-container' ? this.known : this.named; },
    getBoundingClientRect: () => ({ left: 100, right: 700, top, bottom: top + 70, width: 600, height: 70 }) };
  result._nodes = [{ textContent: text, parentElement: result }];
  return result;
}
const context = { window: {}, document, NodeFilter: { SHOW_TEXT: 4 }, getComputedStyle: e => e.style };
document.createTreeWalker = element => {
  let index = 0;
  return { nextNode: () => (element._nodes || [])[index++] };
};
vm.runInNewContext(fs.readFileSync(`${__dirname}/../extension/auto-captions.js`, "utf8"), context);
const find = context.window.FloatlineAutoCaptions.find;
const video = { getBoundingClientRect: () => ({ left: 0, right: 800, top: 0, bottom: 500, width: 800, height: 500 }) };
const dialogue = element("This is the current dialogue", { known: true });
const languageButton = element("Türkçe", { control: true });
const captionSetting = element("Subtitles");
const unrelated = element("A title outside the video", { top: 600 });
document.children.push(languageButton, captionSetting, unrelated, dialogue);
assert.equal(find(video), dialogue);
dialogue.hidden = true;
assert.equal(find(video), null, "Hidden captions do not become a source");
dialogue.hidden = false;
const menu = element("", { control: true });
dialogue.parentElement = menu;
assert.equal(find(video), null, "Caption-named text in a menu/control is rejected");
dialogue.parentElement = null;
dialogue.style.opacity = "0";
assert.equal(find(video), null);
dialogue.style.opacity = "1";
dialogue.isConnected = false;
const host = element("", { named: false });
const shadowDialogue = element("Dialogue inside a shadow root", { known: true });
const shadow = scope([shadowDialogue]);
shadow.host = host;
host.shadowRoot = shadow;
shadowDialogue.getRootNode = () => shadow;
document.children.push(host);
assert.equal(find(video), shadowDialogue, "Discover named regions inside open shadow roots");
host.hidden = true;
assert.equal(find(video), null, "A hidden shadow host also excludes its captions");
host.hidden = false;
shadowDialogue.named = false;
shadowDialogue.known = false;
host.named = true;
assert.equal(find(video), shadowDialogue, "Named hosts may contain unnamed caption nodes");
host.id = "floatline-controls";
assert.equal(find(video), null, "Never discover the extension's own status text");
console.log("Automatic caption detection: dialogue, control/language exclusion, geometry, hidden ancestors and shadow hosts passed.");
