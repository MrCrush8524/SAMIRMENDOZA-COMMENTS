import { useAppState } from "../lib/appState";
import { useModelLoadState } from "../lib/tts/useModelLoadState";
import { ensureModelReady } from "../lib/tts/kokoroEngine";
import "./VoicesScreen.css";

export function VoicesScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { voices, voiceId, selectVoice } = useAppState();
  const loadState = useModelLoadState();

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-button" onClick={onOpenDrawer} aria-label="Menu">
          &#9776;
        </button>
        <div className="topbar__title">Voices</div>
      </div>

      <h3 className="section-title">Narration model</h3>
      <ModelStatus loadState={loadState} />

      <h3 className="section-title">Voices</h3>
      {voices.length === 0 ? (
        <p className="voices__hint">Voices appear here once the narration model finishes loading.</p>
      ) : (
        <ul className="voice-list">
          {voices.map((v) => (
            <li key={v.id}>
              <button
                className={`voice-row${v.id === voiceId ? " voice-row--active" : ""}`}
                onClick={() => selectVoice(v.id)}
              >
                {v.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModelStatus({ loadState }: { loadState: ReturnType<typeof useModelLoadState> }) {
  switch (loadState.status) {
    case "not-started":
      return (
        <button className="button button--teal" onClick={() => ensureModelReady().catch(() => {})}>
          Load narration model
        </button>
      );
    case "loading": {
      const pct = Math.round(loadState.progress * 100);
      return (
        <div>
          <p className="voices__hint">
            Loading model... {pct}% {loadState.file ? `(${loadState.file})` : ""}
          </p>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="voices__hint voices__hint--small">
            ~80-100MB, cached by your browser after the first load -- this only happens once.
          </p>
        </div>
      );
    }
    case "ready":
      return <p className="voices__ready">Narration model ready</p>;
    case "failed":
      return (
        <div>
          <p className="voices__error">Failed to load: {loadState.message}</p>
          <button className="button button--teal" onClick={() => ensureModelReady().catch(() => {})}>
            Retry
          </button>
        </div>
      );
  }
}
