import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../lib/appState";
import { CoverGlow } from "../components/CoverGlow";
import { PLAYBACK_MODE_LABEL, SLEEP_TIMER_PRESETS_MIN, SPEED_OPTIONS } from "../lib/types";
import type { PlaybackMode } from "../lib/types";
import "./NowPlayingScreen.css";

export function NowPlayingScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const {
    currentManuscript,
    mode,
    selectMode,
    isBuffering,
    generationError,
    playback,
    speed,
    setSpeed,
    sleepTimer,
    startSleepTimer,
    cancelSleepTimer
  } = useAppState();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  const { controller, state } = playback;

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-button" onClick={onOpenDrawer} aria-label="Menu">
          &#9776;
        </button>
        <div className="topbar__title">{currentManuscript?.title ?? "SMR"}</div>
      </div>

      {!currentManuscript ? (
        <div className="now-playing__empty">
          <p>No manuscript loaded yet</p>
          <p className="now-playing__empty-sub">Import one from your library to start listening.</p>
          <Link to="/library" className="button button--teal">
            Open Library
          </Link>
        </div>
      ) : (
        <>
          <CoverGlow coverUrl={currentManuscript.coverDataUrl} alt={currentManuscript.title} />

          <h2 className="now-playing__title">{currentManuscript.title}</h2>
          {currentManuscript.author && <p className="now-playing__author">{currentManuscript.author}</p>}

          <div className="mode-row">
            {(Object.keys(PLAYBACK_MODE_LABEL) as PlaybackMode[]).map((m) => (
              <button
                key={m}
                className={`chip${mode === m ? " chip--active" : ""}`}
                onClick={() => selectMode(m)}
              >
                {PLAYBACK_MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {isBuffering && <p className="now-playing__status">Generating narration...</p>}
          {generationError && <p className="now-playing__error">{generationError}</p>}

          <div className="scrubber">
            <input
              type="range"
              min={0}
              max={state.duration || 1}
              value={Math.min(state.currentTime, state.duration || 1)}
              onChange={(e) => controller.seekWithinChunk(Number(e.target.value))}
            />
            <div className="scrubber__labels">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>

          <div className="transport">
            <button className="icon-button icon-button--lg" onClick={() => controller.seekBackward()} aria-label="Back 15 seconds">
              &#8630;15
            </button>
            <button
              className="play-button"
              onClick={() => (state.isPlaying ? controller.pause() : controller.play())}
              aria-label={state.isPlaying ? "Pause" : "Play"}
            >
              {state.isPlaying ? "⏸" : "▶"}
            </button>
            <button className="icon-button icon-button--lg" onClick={() => controller.seekForward()} aria-label="Forward 15 seconds">
              15&#8631;
            </button>
          </div>

          <div className="transport-secondary">
            <button className="icon-button" onClick={() => setShowSpeedMenu(true)} aria-label="Playback speed">
              &#8987; {speed}x
            </button>
            <button className="icon-button" onClick={() => setShowSleepMenu(true)} aria-label="Sleep timer">
              &#9210; {sleepTimer.status === "active" ? formatTime(sleepTimer.remainingMs / 1000) : ""}
            </button>
          </div>

          {showSpeedMenu && (
            <Modal onClose={() => setShowSpeedMenu(false)} title="Playback speed">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`modal-option${s === speed ? " modal-option--active" : ""}`}
                  onClick={() => {
                    setSpeed(s);
                    setShowSpeedMenu(false);
                  }}
                >
                  {s}x
                </button>
              ))}
            </Modal>
          )}

          {showSleepMenu && (
            <Modal onClose={() => setShowSleepMenu(false)} title="Sleep timer">
              {SLEEP_TIMER_PRESETS_MIN.map((m) => (
                <button
                  key={m}
                  className="modal-option"
                  onClick={() => {
                    startSleepTimer(m);
                    setShowSleepMenu(false);
                  }}
                >
                  {m} minutes
                </button>
              ))}
              <button
                className="modal-option modal-option--danger"
                onClick={() => {
                  cancelSleepTimer();
                  setShowSleepMenu(false);
                }}
              >
                Off
              </button>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{title}</h3>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
