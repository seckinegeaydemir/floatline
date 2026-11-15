// Regression checks for the wrong-source screenshot and caption lifecycle.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const listeners = new Map();
let nodes = [];
let ticks = [];
let liveRegion = null;
const rect = { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 };
const document = {
  body: { querySelectorAll: () => [] },
  createElement: () => ({textContent: ""}),
  documentElement: { appendChild(style) { assert.match(style.textContent, /font-size:80%/); assert.match(style.textContent, /background:transparent/); } },
  addEventListener: (name, handler) => listeners.set(name, handler),
  removeEventListener: name => listeners.delete(name),
  createTreeWalker: scope => {
    const values = scope._nodes || nodes;
    let index = 0;
    return { nextNode: () => values[index++] };
  },
  createRange: () => {
    let node;
    return { selectNodeContents: value => { node = value; }, getClientRects: () => [node.rect] };
  },
  querySelector: () => liveRegion
};
class Element {
  constructor(text = "") {
    this.textContent = text;
    this.nodeType = 1;
    this.localName = "p";
    this.tagName = "P";
    this.isConnected = true;
  }
  closest(selector) { return selector === "p" ? this : null; }
  getRootNode() { return document; }
  getClientRects() { return [{}]; }
  getBoundingClientRect() { return rect; }
}
class VTTCue {
  constructor(startTime, endTime, text) { Object.assign(this, { startTime, endTime, text }); }
}
const context = {
  window: {}, document, Element, VTTCue, CSS: { escape: s => s },
  NodeFilter: { SHOW_TEXT: 4 },
  getComputedStyle: element => ({ visibility: element.hidden ? "hidden" : "visible", display: "block", opacity: "1" }),
  setInterval: fn => { ticks.push(fn); return fn; },
  clearInterval: fn => { ticks = ticks.filter(t => t !== fn); }
};
vm.runInNewContext(fs.readFileSync(`${__dirname}/../extension/captions.js`, "utf8"), context);
const captions = context.window.FloatlineCaptions;
let added = 0;
const track = { mode: "disabled", cues: [], addCue: c => track.cues.push(c),
  removeCue: c => track.cues.splice(track.cues.indexOf(c), 1) };
const video = { isConnected: true, currentTime: 10, webkitPresentationMode: "picture-in-picture",
  setAttribute() {}, removeAttribute() {},
  addTextTrack: () => { added++; return track; }, addEventListener() {}, removeEventListener() {} };
let message = "";
let accepted = 0;
const status = new Element("PiP istendi.");
const host = new Element();
host.id = "floatline-controls";
status.getRootNode = () => ({ host });
captions.pick(s => { message = s; }, () => { accepted++; });
listeners.get("click")({ composedPath: () => [status, host],
  preventDefault: () => assert.fail("Own controls must not be intercepted") });
captions.start(video, s => { message = s; });
assert.equal(added, 0, "A message inside our shadow root must never become a caption source");

// Clicking the underlying video without rendered text must not use its textContent.
const target = new Element("PiP istendi.");
listeners.get("click")({ composedPath: () => [target], clientX: 50, clientY: 50,
  preventDefault() {}, stopImmediatePropagation() {} });
assert.equal(accepted, 0);

// Text with pointer-events:none is discoverable by its text range geometry.
const paragraph = new Element("First line\nSecond line");
function textNode(element) {
  return { get textContent() { return element.textContent; }, parentElement: element, rect };
}
const region = new Element();
region.id = "caption-region";
region.children = [paragraph];
paragraph.parentElement = region;
region._nodes = [textNode(paragraph)];
liveRegion = region;
nodes = region._nodes;
listeners.get("click")({ composedPath: () => [target], clientX: 50, clientY: 50,
  preventDefault() {}, stopImmediatePropagation() {} });
assert.equal(accepted, 1);
captions.start(video, s => { message = s; });
assert.equal(track.cues.length, 1);
assert.equal(track.cues[0].text, "<c.floatline>First line\nSecond line</c>");
assert.equal(track.cues[0].line, -4, "Keep captions above the native PiP control bar");
video.currentTime = 10.5;
ticks[0]();
assert.equal(track.cues.length, 1, "Repeated updates must not duplicate cues");
paragraph.textContent = "Next dialogue";
ticks[0]();
assert.equal(track.cues[0].text, "<c.floatline>Next dialogue</c>");
// The old sentence remains connected but hidden; Disney+ inserts another one.
paragraph.hidden = true;
const replacement = new Element("Replacement dialogue");
replacement.parentElement = region;
region._nodes = [textNode(paragraph), textNode(replacement)];
ticks[0]();
assert.equal(paragraph.isConnected, true);
assert.equal(track.cues[0].text, "<c.floatline>Replacement dialogue</c>", "Track the current region instead of the stale connected sentence");
// The entire caption region may be replaced too.
liveRegion = new Element();
liveRegion.id = "caption-region";
liveRegion._nodes = [textNode(replacement)];
replacement.parentElement = liveRegion;
replacement.textContent = "New region dialogue";
ticks[0]();
assert.equal(track.cues[0].text, "<c.floatline>New region dialogue</c>");
replacement.textContent = "";
ticks[0]();
assert.equal(track.cues.length, 0, "Dialogue gaps must clear the previous caption");
replacement.textContent = "After seeking";
video.currentTime = 2;
ticks[0]();
assert.equal(track.cues[0].startTime, 1.9);
captions.pick(() => {});
assert.equal(track.mode, "disabled");
assert.equal(track.cues.length, 0, "Reselection must clear the old source immediately");
assert.equal(ticks.length, 0);

// Reproduce the live report: the top div belongs to a ShadowRoot, so it has
// parentNode.children but no parentElement. Its path must be nth-of-type(1).
let liveHost = new Element();
liveHost.id = "shadow-caption-host";
const shadow = { host: liveHost, children: [] };
liveHost.shadowRoot = shadow;
document.querySelector = selector => selector === "#shadow-caption-host" ? liveHost : liveRegion;
function shadowTree(root, text) {
  const top = new Element();
  top.localName = "div";
  top.tagName = "DIV";
  top.parentNode = root;
  top.getRootNode = () => root;
  const leaf = new Element(text);
  leaf.parentElement = top;
  leaf.parentNode = top;
  leaf.getRootNode = () => root;
  top.children = [leaf];
  top._nodes = [textNode(leaf)];
  root.children = [top];
  root.querySelector = selector => {
    assert.equal(selector, "div:nth-of-type(1)", "Shadow root child must have a valid one-based CSS index");
    return root.children[0];
  };
  return top;
}
const oldTop = shadowTree(shadow, "Shadow sentence one");
nodes = oldTop._nodes;
captions.pick(() => {});
listeners.get("click")({ composedPath: () => [target], clientX: 50, clientY: 50,
  preventDefault() {}, stopImmediatePropagation() {} });
assert.match(captions.inspect().sourceSelector, /shadow/);
assert.doesNotMatch(captions.inspect().sourceSelector, /nth-of-type\(0\)/);
captions.start(video, () => {});
assert.equal(track.cues[0].text, "<c.floatline>Shadow sentence one</c>");
oldTop.isConnected = false;
shadowTree(shadow, "Shadow sentence two");
ticks[0]();
assert.equal(track.cues[0].text, "<c.floatline>Shadow sentence two</c>", "Resolve new shadow root children after the original sentence is removed");
const newHost = new Element();
newHost.id = "shadow-caption-host";
const newShadow = { host: newHost, children: [] };
newHost.shadowRoot = newShadow;
shadowTree(newShadow, "Shadow host replaced");
liveHost.isConnected = false;
liveHost = newHost;
ticks[0]();
assert.equal(track.cues[0].text, "<c.floatline>Shadow host replaced</c>", "Reacquire the shadow root when its host is replaced");
newShadow.children[0]._nodes[0].parentElement.textContent = "";
ticks[0]();
assert.equal(track.mode, "hidden");
assert.equal(track.cues.length, 0);
captions.stop();
const native = { kind: "subtitles", label: "Türkçe", mode: "showing" };
video.textTracks = [native];
captions.pick(() => {});
const trackCount = added;
captions.start(video, () => {});
assert.equal(added, trackCount, "Use an enabled native track without creating a duplicate caption track");
assert.equal(native.mode, "showing");
assert.equal(captions.inspect().state, "Oynatıcının yerel altyazısı kullanılıyor");
console.log("Caption source exclusion, geometric picking, sentence/region replacement, hidden stale text, seeking and cleanup passed.");
console.log("Shadow root one-based paths, subtree replacement, host replacement and native caption hiding passed.");

// Start PiP during a dialogue gap; later discover and replace a source without
// any click, then verify empty dialogue clears the native cue.
video.textTracks = [];
listeners.get("keydown")({ key: "Escape" });
let autoRegion = null;
context.window.FloatlineAutoCaptions = { find: () => autoRegion };
let now = 10000;
context.Date = { now: () => now };
document.querySelector = () => autoRegion;
captions.start(video, () => {});
assert.equal(track.cues.length, 0, "Wait for an automatic source during silence");
autoRegion = new Element("Auto dialogue");
autoRegion.id = "auto-caption";
const autoLeaf = new Element("Auto dialogue");
autoLeaf.parentElement = autoRegion;
autoRegion._nodes = [textNode(autoLeaf)];
now += 1100;
ticks[0]();
assert.equal(track.cues[0].text, "<c.floatline>Auto dialogue</c>");
assert.equal(captions.inspect().state, "Otomatik altyazı aktarılıyor");
autoRegion = new Element("Replacement auto region");
autoRegion.id = "auto-caption-2";
autoLeaf.textContent = "Replacement auto region";
autoLeaf.parentElement = autoRegion;
autoRegion._nodes = [textNode(autoLeaf)];
now += 1100;
ticks[0]();
assert.equal(track.cues[0].text, "<c.floatline>Replacement auto region</c>");
autoLeaf.textContent = "";
ticks[0]();
assert.equal(track.cues.length, 0);
captions.stop();
console.log("Automatic caption waiting, discovery, replacement and silence cleanup passed.");

// Caption size from the Floatline app: clamped and ignored when invalid.
assert.equal(typeof captions.setScale, "function");
captions.setScale(500);
captions.setScale("abc");
captions.setScale(30);
console.log("Caption scale setter accepted values without throwing.");
