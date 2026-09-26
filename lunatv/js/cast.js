// Casting to TVs.
//  • Chromecast / Google TV: Google's official Cast Web Sender SDK (Chrome on
//    Android, Windows, macOS, ChromeOS). The TV downloads the stream itself, so
//    it needs a real web address — live channels and stream/video URLs cast;
//    videos stored inside this browser (blob:) can't be sent to a Chromecast.
//  • AirPlay (iPhone, iPad, Mac Safari): handled natively by the <video>
//    element in player.js; works for local videos and streams alike.
//  • Other Chrome devices: the standard Remote Playback API, when the browser
//    reports a device for the current video.
// Nothing is shown unless a real device is available.
import { tr, trn } from "./i18n.js";
import { emit, isIOS } from "./util.js";

const SDK = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
let ctx = null, loading = null, state = "NO_DEVICES_AVAILABLE", remote = null, ctl = null;

export const castSupported = () => !isIOS && /Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\//.test(navigator.userAgent) && location.protocol !== "file:";

/** Loads the SDK once; resolves true when Chromecast discovery is running. */
export function initCast() {
  if (!castSupported()) return Promise.resolve(false);
  return loading ||= new Promise(res => {
    const t = setTimeout(() => res(false), 15000);
    window.__onGCastApiAvailable = ok => {
      clearTimeout(t);
      if (!ok || !window.cast?.framework) return res(false);
      try {
        ctx = cast.framework.CastContext.getInstance();
        ctx.setOptions({ receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
        state = ctx.getCastState();
        ctx.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, e => { state = e.castState; emit("cast-state", state); });
        remote = new cast.framework.RemotePlayer();
        ctl = new cast.framework.RemotePlayerController(remote);
        const E = cast.framework.RemotePlayerEventType;
        for (const ev of [E.IS_CONNECTED_CHANGED, E.CURRENT_TIME_CHANGED, E.IS_PAUSED_CHANGED, E.DURATION_CHANGED, E.PLAYER_STATE_CHANGED])
          ctl.addEventListener(ev, () => emit("cast-remote", snapshot()));
        emit("cast-state", state);
        res(true);
      } catch { res(false); }
    };
    const s = document.createElement("script");
    s.src = SDK; s.async = true;
    s.onerror = () => { clearTimeout(t); loading = null; res(false); };
    document.head.append(s);
  });
}

export const devicesAvailable = () => !!ctx && state !== "NO_DEVICES_AVAILABLE";
export const isCasting = () => !!remote?.isConnected;
export const deviceName = () => ctx?.getCurrentSession?.()?.getCastDevice?.()?.friendlyName || "TV";
export function snapshot() {
  return remote ? { connected: remote.isConnected, paused: remote.isPaused, time: remote.currentTime || 0, duration: remote.duration || 0, state: remote.playerState, device: deviceName() } : { connected: false };
}

const typeOf = url => /\.m3u8($|\?)|\/hls\/|m3u8/i.test(url) ? "application/x-mpegURL" : /\.mpd($|\?)/i.test(url) ? "application/dash+xml" : /\.webm($|\?)/i.test(url) ? "video/webm" : "video/mp4";

/** Send a stream/video URL to the Chromecast. Opens the device picker if needed. */
export async function castURL({ url, title, subtitle = "", image = "", live = false, startTime = 0 }) {
  if (!ctx) throw new Error(tr("Casting isn’t available in this browser."));
  if (!/^https?:/i.test(url)) throw new Error(tr("This video is stored inside the browser, so a Chromecast can’t reach it. Use AirPlay on iPhone/Mac, or cast a stream instead."));
  if (!ctx.getCurrentSession()) {
    try { await ctx.requestSession(); }
    catch (e) { if (e === "cancel" || e?.code === "cancel") return false; throw new Error(tr("Couldn’t connect to the TV.")); }
  }
  const s = ctx.getCurrentSession();
  const info = new chrome.cast.media.MediaInfo(url, typeOf(url));
  info.streamType = live ? chrome.cast.media.StreamType.LIVE : chrome.cast.media.StreamType.BUFFERED;
  const md = new chrome.cast.media.GenericMediaMetadata();
  md.title = title; md.subtitle = subtitle;
  if (/^https:/.test(image)) md.images = [new chrome.cast.Image(image)];
  info.metadata = md;
  const req = new chrome.cast.media.LoadRequest(info);
  req.autoplay = true; req.currentTime = live ? 0 : startTime;
  try { await s.loadMedia(req); }
  catch { throw new Error(tr("The TV couldn’t play this stream. Its host may not allow other devices to fetch it.")); }
  return true;
}
export const remoteToggle = () => ctl?.playOrPause();
export function remoteSeek(t) { if (!remote) return; remote.currentTime = Math.max(0, t); ctl.seek(); }
export const stopCasting = () => { try { ctx?.endCurrentSession(true); } catch {} };
