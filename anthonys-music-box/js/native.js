// Android app bridge (Capacitor). Does nothing in a normal browser.
// Mirrors the player into the native media notification / lock screen and
// routes the hardware back button through AMB's own navigation.
const Cap = window.Capacitor;
export const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

function plugin(name) {
  try { return typeof Cap.registerPlugin === 'function' ? Cap.registerPlugin(name) : Cap.Plugins[name]; }
  catch { return Cap?.Plugins?.[name]; }
}

// Small JPEG data URL for the notification artwork.
async function artworkData(src) {
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const c = document.createElement('canvas'); c.width = c.height = 320;
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 320, 320);
    return c.toDataURL('image/jpeg', 0.85);
  } catch { return null; }
}

export function initNative({ E, Lib, onBack }) {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  const Media = plugin('AmbMedia');
  const App = plugin('App');

  let artKey = '', art = null, sentAt = 0, sentPos = 0, sentPlaying = false, busy = null;
  async function push() {
    const S = E.S, t = Lib.get(S.id), st = S.station;
    if (!t && !st) { Media?.stop().catch(() => {}); artKey = ''; return; }
    const key = st ? 'st:' + st.id : t.id + ':' + (t.thumb?.size || t.art?.size || 0);
    if (key !== artKey) { artKey = key; art = await artworkData(st ? (st.favicon || Lib.DEFAULT_ART) : Lib.artOf(t)); }
    const playing = S.playing || (S.loading && !S.error);
    sentAt = Date.now(); sentPos = S.time || 0; sentPlaying = playing;
    await Media?.update({
      title: st ? st.name : Lib.trackTitle(t),
      artist: st ? 'Live Radio' : Lib.trackArtist(t),
      album: st ? '' : (t.album || "Anthony's Music Box"),
      playing, live: !!st,
      duration: st ? 0 : (S.duration || t.duration || 0),
      position: sentPos,
      artwork: art || undefined,
    }).catch(e => console.warn('AmbMedia', e));
  }
  const schedule = () => { busy = (busy || Promise.resolve()).then(push, push); };

  E.subscribe((S, kind) => {
    if (kind === 'init' || kind === 'track' || kind === 'state' || kind === 'error' || kind === 'element') schedule();
    else if (kind === 'time' && !S.station) {
      // Only resync the lock-screen position after a seek, not every tick.
      const expected = sentPos + (sentPlaying ? (Date.now() - sentAt) / 1000 : 0);
      if (Math.abs((S.time || 0) - expected) > 2) schedule();
    }
  });

  Media?.addListener('action', ({ action, position }) => {
    if (action === 'play') E.play();
    else if (action === 'pause') E.pause();
    else if (action === 'next') E.next();
    else if (action === 'previous') E.prev();
    else if (action === 'seek') E.seek(position);
  });

  // Back closes sheets / Now Playing / pages; at the top level AMB goes to the
  // background instead of quitting, so music keeps playing.
  App?.addListener('backButton', () => { if (!onBack()) App.minimizeApp().catch(() => {}); });
}
