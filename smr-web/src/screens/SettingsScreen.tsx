import "./SettingsScreen.css";

export function SettingsScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-button" onClick={onOpenDrawer} aria-label="Menu">
          &#9776;
        </button>
        <div className="topbar__title">Settings</div>
      </div>

      <h3 className="section-title">Background &amp; lock-screen playback</h3>
      <p className="settings__text">
        SMR publishes Media Session metadata, so supporting browsers (Chrome on Android, most
        desktop browsers) show lock-screen and notification-shade transport controls while a tab
        is open. Unlike the Android build, a browser tab can be suspended by the OS when you
        switch away or lock the screen, so continuous playback isn't guaranteed once the tab
        loses focus -- keep the tab open and the screen on for uninterrupted narration.
      </p>

      <h3 className="section-title">Mixing with other audio</h3>
      <p className="settings__text">
        There's no browser API that lets a web page request to mix with another app's audio the
        way a native Android app can. If you're playing music elsewhere on your device, this tab
        and that app will share whatever the OS does by default (usually both keep playing).
      </p>

      <h3 className="section-title">Privacy</h3>
      <p className="settings__text">
        Manuscripts stay in this browser's local storage (IndexedDB) and are never uploaded,
        except for a short excerpt sent to Claude when you use Retell, Summary, or Podcast mode.
        Read mode narrates entirely on-device and never touches the network. The narration model
        itself downloads once, from Hugging Face, and is cached by your browser after that.
      </p>
    </div>
  );
}
