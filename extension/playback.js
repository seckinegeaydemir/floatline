(() => {
  "use strict";
  let video = null;
  let timer;
  let lastError = "";
  const events = ["timeupdate", "durationchange", "loadedmetadata", "ratechange", "seeked", "play", "pause", "webkitpresentationmodechanged", "enterpictureinpicture", "leavepictureinpicture"];

  function active() {
    return video && (video.webkitPresentationMode === "picture-in-picture" || document.pictureInPictureElement === video);
  }

  function sync() {
    if (!active() || !video.isConnected) return;
    const duration = video.duration;
    const position = video.currentTime;
    const playbackRate = video.playbackRate;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) ||
        !Number.isFinite(playbackRate) || playbackRate <= 0) return;
    const mediaSession = navigator.mediaSession;
    if (typeof mediaSession?.setPositionState !== "function") return;
    try {
      // Report the entire episode, never duration-currentTime or buffered.end.
      mediaSession.setPositionState({ duration, position: Math.max(0, Math.min(position, duration)), playbackRate });
      lastError = "";
    } catch (error) {
      lastError = `${error.name}: ${error.message}`;
    }
  }

  function detach() {
    clearInterval(timer);
    if (video) for (const event of events) video.removeEventListener(event, sync);
    video = null;
  }

  function ranges(value) {
    if (!value) return [];
    return Array.from({ length: value.length }, (_, index) => [
      Number(value.start(index).toFixed(2)), Number(value.end(index).toFixed(2))
    ]);
  }

  window.FloatlinePlayback = {
    attach(next) {
      if (next === video) return sync();
      detach();
      video = next;
      lastError = "";
      for (const event of events) video.addEventListener(event, sync);
      timer = setInterval(sync, 500);
      sync();
    },
    inspect() {
      return {
        duration: video && Number.isFinite(video.duration) ? Number(video.duration.toFixed(2)) : null,
        currentTime: video ? Number(video.currentTime.toFixed(2)) : null,
        seekable: ranges(video?.seekable),
        buffered: ranges(video?.buffered),
        positionAPI: typeof navigator.mediaSession?.setPositionState === "function",
        error: lastError
      };
    },
    detach
  };
})();
