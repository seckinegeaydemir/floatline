const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(`${__dirname}/../extension/seek-bridge.js`, "utf8");

function setup({ withPlayer = true } = {}) {
  const listeners = new Map();
  const attributes = {};
  let now = 0;
  const seeks = [];
  const player = { time: 10000, seek(ms) { seeks.push(ms); this.time = ms; }, getCurrentTime() { return this.time; } };
  const document = {
    pictureInPictureElement: null,
    documentElement: { setAttribute: (k, v) => { attributes[k] = v; } },
    addEventListener: (event, fn) => listeners.set(event, fn)
  };
  const window = {
    netflix: withPlayer ? { appContext: { state: { playerApp: { getAPI: () => ({ videoPlayer: {
      getAllPlayerSessionIds: () => ["a"], getVideoPlayerBySessionId: () => player } }) } } } } : undefined
  };
  vm.runInNewContext(source, { window, document, JSON, Number, Math, Date: { now: () => now } });
  const video = { tagName: "VIDEO", webkitPresentationMode: "picture-in-picture", currentTime: 10,
    duration: 2650.4, playbackRate: 1, seekable: { length: 1, start: () => 0, end: () => 2650.4 } };
  return {
    seek(time) { video.currentTime = time; listeners.get("seeking")({ target: video }); },
    video, seeks, player, stats: () => JSON.parse(attributes["data-floatline-seek"]),
    advance(ms) { now += ms; },
    enterPip() { listeners.get("webkitpresentationmodechanged")({ target: video }); },
    tick() { listeners.get("timeupdate")({ target: video }); }
  };
}

// A PiP bar seek far from Netflix's own time is forwarded in milliseconds.
let t = setup();
assert.equal(t.stats().main, true, "Publishes a marker so MAIN-world execution is observable");
t.seek(300);
assert.deepEqual(t.seeks, [300000]);
assert.equal(t.stats().forwarded, 1);

// Netflix's follow-up seek to the same spot does not loop.
t.advance(2000);
t.seek(300.4);
assert.deepEqual(t.seeks, [300000]);

// Outside PiP nothing is touched.
t.video.webkitPresentationMode = "inline";
t.advance(2000);
t.seek(900);
assert.deepEqual(t.seeks, [300000]);

// Fail closed when Netflix's player API is missing.
t = setup({ withPlayer: false });
t.seek(500);
assert.equal(t.stats().apiMissing, 1);
assert.equal(t.stats().forwarded, 0);

// Diagnostics: PiP snapshot, all seeking events and unexplained time jumps.
t = setup();
t.enterPip();
assert.equal(t.stats().duration, 2650);
assert.equal(t.stats().seekable, "0-2650");
assert.equal(t.stats().api, true);
t.tick();
t.advance(1000);
t.video.currentTime = 11;
t.tick();
assert.equal(t.stats().jumps, 0, "Normal playback is not a jump");
t.advance(1000);
t.video.currentTime = 400;
t.tick();
assert.equal(t.stats().jumps, 1);
t.video.webkitPresentationMode = "inline";
t.seek(20);
assert.equal(t.stats().seekingAny, 1);
assert.equal(t.stats().seen, 0);

console.log("Seek bridge forwarding, loop guard, PiP-only and fail-closed passed.");
