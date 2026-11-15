const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const states = [];
const events = new Map();
let poll;
const context = { window: {}, document: {}, navigator: { mediaSession: {
  setPositionState: state => states.push(state),
  setActionHandler: () => assert.fail("Keep Disney+ seek handlers intact")
} }, setInterval: fn => { poll = fn; return fn; }, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(`${__dirname}/../extension/playback.js`, "utf8"), context);
const video = { isConnected: true, duration: 2500, currentTime: 700, playbackRate: 1,
  webkitPresentationMode: "picture-in-picture",
  seekable: { length: 1, start: () => 690, end: () => 2500 },
  buffered: { length: 1, start: () => 690, end: () => 740 },
  addEventListener: (name, fn) => events.set(name, fn),
  removeEventListener: name => events.delete(name) };
const playback = context.window.FloatlinePlayback;
playback.attach(video);
assert.equal(states.at(-1).duration, 2500, "Report full duration, not the remaining 1800 seconds");
assert.equal(states.at(-1).position, 700);
video.currentTime = 100;
events.get("seeked")();
assert.equal(states.at(-1).position, 100, "Use the actual video position after backward seeking");
assert.equal(states.at(-1).duration, 2500);
const report = playback.inspect();
assert.equal(report.seekable[0][0], 690, "Do not pretend seekable coverage changed");
video.webkitPresentationMode = "inline";
const count = states.length;
poll();
assert.equal(states.length, count, "Update Media Session only during PiP");
video.webkitPresentationMode = "picture-in-picture";
video.duration = Infinity;
poll();
assert.equal(states.length, count, "Do not invent a duration for live/unknown streams");
playback.detach();
assert.equal(events.size, 0);
console.log("Full duration, seek position, actual seekable range, PiP-only updates and cleanup passed.");
