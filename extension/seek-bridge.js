(() => {
  "use strict";
  // MAIN world, Netflix only. Safari's PiP bar sets the <video> time directly
  // (WebKit PlaybackSessionModelMediaElement::seekToTime), which Netflix's
  // player ignores. When a seek happens during PiP, hand the target time to
  // Netflix's own player. Fail closed: if that player is not reachable, do
  // nothing (never write currentTime ourselves).
  if (window.FloatlineSeek) return;
  const root = document.documentElement;
  // seekingAny: every "seeking" event, PiP or not. jumps: time moved >3 s
  // in PiP without a "seeking" event. duration/seekable/api: snapshot taken
  // when PiP opens, to see whether Safari has anything to scrub against.
  const stats = { main: true, seen: 0, forwarded: 0, skipped: 0, apiMissing: 0, error: "",
    seekingAny: 0, jumps: 0, duration: null, seekable: "", api: null };
  let lastTime = null;
  let lastClock = 0;
  let cooldownUntil = 0;

  function publish() {
    // The isolated-world UI (content.js) reads this to report what happened.
    try { root?.setAttribute("data-floatline-seek", JSON.stringify(stats)); } catch {}
  }

  function inPip(video) {
    return video?.webkitPresentationMode === "picture-in-picture" ||
      document.pictureInPictureElement === video;
  }

  function netflixPlayer() {
    try {
      const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.();
      const videoPlayer = api?.videoPlayer;
      const ids = videoPlayer?.getAllPlayerSessionIds?.() || [];
      const id = ids[ids.length - 1];
      const player = id != null ? videoPlayer.getVideoPlayerBySessionId(id) : null;
      return typeof player?.seek === "function" ? player : null;
    } catch (exception) {
      stats.error = `${exception.name}: ${exception.message}`;
      return null;
    }
  }

  function ranges(value) {
    try {
      return Array.from({ length: value?.length || 0 }, (_, i) =>
        `${Math.round(value.start(i))}-${Math.round(value.end(i))}`).join(",") || "boş";
    } catch { return "?"; }
  }

  function onModeChange(event) {
    const video = event.target;
    if (!video || video.tagName !== "VIDEO" || !inPip(video)) return;
    stats.duration = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
    stats.seekable = ranges(video.seekable);
    stats.api = Boolean(netflixPlayer());
    lastTime = null;
    publish();
  }

  function onTimeUpdate(event) {
    const video = event.target;
    if (!video || video.tagName !== "VIDEO" || !inPip(video)) return;
    const now = Date.now();
    const time = Number(video.currentTime);
    if (lastTime != null && Number.isFinite(time)) {
      const expected = (now - lastClock) / 1000 * (video.playbackRate || 1);
      if (Math.abs(time - lastTime - expected) > 3) { stats.jumps++; publish(); }
    }
    lastTime = time;
    lastClock = now;
  }

  function onSeeking(event) {
    const video = event.target;
    if (video?.tagName === "VIDEO") { stats.seekingAny++; publish(); }
    if (!video || video.tagName !== "VIDEO" || !inPip(video)) return;
    stats.seen++;
    const target = Number(video.currentTime);
    if (!Number.isFinite(target) || Date.now() < cooldownUntil) {
      stats.skipped++;
      return publish();
    }
    const player = netflixPlayer();
    if (!player) {
      stats.apiMissing++;
      return publish();
    }
    try {
      const current = Number(player.getCurrentTime?.()) / 1000;
      // Netflix's own follow-up seek lands on the same time: ignore it.
      if (Number.isFinite(current) && Math.abs(current - target) < 1.5) {
        stats.skipped++;
        return publish();
      }
      cooldownUntil = Date.now() + 1000;
      player.seek(Math.round(target * 1000));
      stats.forwarded++;
      stats.error = "";
    } catch (exception) {
      stats.error = `${exception.name}: ${exception.message}`;
    }
    publish();
  }

  // "seeking" does not bubble, but capture-phase listeners still receive it.
  document.addEventListener("seeking", onSeeking, true);
  document.addEventListener("timeupdate", onTimeUpdate, true);
  for (const name of ["webkitpresentationmodechanged", "enterpictureinpicture"]) {
    document.addEventListener(name, onModeChange, true);
  }
  publish();
  window.FloatlineSeek = { inspect: () => ({ ...stats }) };
})();
