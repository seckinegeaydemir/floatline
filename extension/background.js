// Relays settings requests from content scripts to the Floatline app.
const api = globalThis.browser || globalThis.chrome;

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "floatline-settings") return false;
  api.runtime.sendNativeMessage("com.floatline.Floatline", { type: "getSettings" })
    .then(reply => sendResponse(reply?.settings || null))
    .catch(() => sendResponse(null));
  return true; // keep the channel open for the async reply
});
