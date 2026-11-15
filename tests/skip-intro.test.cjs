const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(`${__dirname}/../extension/skip-intro.js`, "utf8");
function setup({ unsupported = false } = {}) {
  const handlers = new Map();
  const events = new Map();
  const windowEvents = new Map();
  let poll, now = 0;
  const document = {
    elements: [],
    querySelectorAll(selector) {
      if (selector === "*") return this.elements;
      if (selector === "video") return this.elements.filter(e => e.tag === "video");
      return this.elements.filter(e => e.tag === "button");
    },
    addEventListener: (event, fn) => events.set(event, fn)
  };
  function element(tag, text = "") {
    return { tag, innerText: text, isConnected: true, attributes: {},
      style: { display: "block", visibility: "visible", opacity: "1" },
      rect: { width: 180, height: 40, left: 30, top: 30, right: 210, bottom: 70 },
      clicks: 0, getAttribute(name) { return this.attributes[name] ?? null; },
      getBoundingClientRect() { return this.rect; },
      getRootNode: () => document, matches: () => false,
      click() { this.clicks++; this.isConnected = false; }
    };
  }
  const video = element("video");
  video.webkitPresentationMode = "inline";
  document.elements.push(video);
  const session = {
    setActionHandler(action, handler) {
      assert.equal(this, session);
      if (unsupported && action === "skipad") throw new TypeError("Unsupported action");
      if (handler != null && typeof handler !== "function") throw new TypeError("Invalid handler");
      handlers.set(action, handler);
    }
  };
  const context = { window: { addEventListener: (event, fn) => windowEvents.set(event, fn) },
    document, navigator: { mediaSession: session }, innerWidth: 1000, innerHeight: 700,
    getComputedStyle: e => e.style, Date: { now: () => now },
    setInterval: fn => { poll = fn; return fn; }, clearInterval() {}
  };
  vm.runInNewContext(source, context);
  return { session, document, video, handlers, events, windowEvents, element,
    poll: () => poll(), advance: () => { now += 3000; },
    inspect: context.window.FloatlineIntro.inspect };
}
const t = setup();
const seek = () => {};
const siteSkip = () => {};
t.session.setActionHandler("seekto", seek);
t.session.setActionHandler("skipad", siteSkip);
const intro = t.element("button", "Jeneriği Atla");
t.document.elements.push(intro);
t.poll();
assert.equal(t.handlers.get("skipad"), siteSkip, "Inline playback leaves site controls intact");
t.video.webkitPresentationMode = "picture-in-picture";
t.events.get("webkitpresentationmodechanged")();
assert.equal(t.inspect().registered, true);
assert.equal(intro.clicks, 0, "Never automatically skip an intro");
assert.equal(t.handlers.get("seekto"), seek, "Do not overwrite seek controls");
const newSiteSkip = () => {};
t.session.setActionHandler("skipad", newSiteSkip);
assert.notEqual(t.handlers.get("skipad"), newSiteSkip, "Retain native intro control during site updates");
t.handlers.get("skipad")();
assert.equal(intro.clicks, 1);
assert.equal(t.inspect().skipped, 1);
assert.equal(t.handlers.get("skipad"), newSiteSkip, "Restore the latest site handler after skipping");
t.poll();
assert.equal(t.inspect().registered, false);

t.advance();
const replacement = t.element("button", "Skip Intro");
t.document.elements.push(replacement);
t.poll();
const staleAction = t.handlers.get("skipad");
replacement.isConnected = false;
staleAction();
assert.equal(replacement.clicks, 0, "Do not click a stale, disappeared control");

for (const text of ["Skip recap", "Next episode", "Skip ad", "Skip credits", "Intro settings"]) {
  const other = t.element("button", text);
  t.document.elements.push(other);
}
t.poll();
assert.equal(t.inspect().detected, false, "Do not match ads, recap or next episode controls");

const hidden = t.element("button", "Intro’yu Atla");
const ancestor = t.element("div");
ancestor.style.opacity = "0";
hidden.parentElement = ancestor;
t.document.elements.push(hidden);
t.poll();
assert.equal(t.inspect().detected, false, "Invisible ancestor excludes button");
ancestor.style.opacity = "1";
hidden.disabled = true;
t.poll();
assert.equal(t.inspect().detected, false);
hidden.disabled = false;
t.poll();
assert.equal(t.inspect().registered, true, "Turkish apostrophe variants supported");
t.session.setActionHandler("skipad", null);
t.video.webkitPresentationMode = "inline";
t.poll();
assert.equal(t.handlers.get("skipad"), null, "Preserve a site's handler removal on PiP exit");
hidden.isConnected = false;

const host = t.element("div");
const shadowButton = t.element("button", "SKIP INTRO");
const shadow = { host, querySelectorAll: selector => selector === "video" ? [] : [shadowButton] };
host.shadowRoot = shadow;
shadowButton.getRootNode = () => shadow;
t.document.elements.push(host);
t.video.webkitPresentationMode = "picture-in-picture";
t.poll();
assert.equal(t.inspect().registered, true, "Find controls inside open shadow roots");
t.windowEvents.get("pagehide")();
assert.equal(t.handlers.get("skipad"), null, "Page cleanup restores the site's state");
t.windowEvents.get("pageshow")({ persisted: true });
assert.equal(t.inspect().registered, true, "Re-enable after back/forward cache restoration");

const u = setup({ unsupported: true });
u.video.webkitPresentationMode = "picture-in-picture";
const unsupportedButton = u.element("button", "Skip Intro");
u.document.elements.push(unsupportedButton);
u.poll();
assert.equal(u.inspect().supported, false);
assert.match(u.inspect().error, /Unsupported action/);
assert.equal(unsupportedButton.clicks, 0, "Unsupported browsers do not trigger a fallback click");
console.log("Intro detection, native action, site handler preservation, stale/hidden controls, shadow DOM and unsupported API passed.");
