import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as db from "./db";
import { importPlainText } from "./import";
import { synthesize, ensureModelReady, listVoices } from "./tts/kokoroEngine";
import { generateScript } from "./claude/claudeClient";
import { usePlayback } from "./audio/usePlayback";
import { SleepTimer, type SleepTimerState } from "./audio/sleepTimer";
import type { Manuscript, PlaybackMode, Voice } from "./types";

const DEFAULT_VOICE = "af_heart";
const LAST_OPENED_KEY = "lastOpenedManuscriptId";

interface AppStateValue {
  manuscripts: Manuscript[];
  refreshManuscripts: () => Promise<void>;
  importManuscript: (file: File) => Promise<void>;
  deleteManuscript: (id: string) => Promise<void>;

  currentManuscript: Manuscript | null;
  openManuscript: (manuscript: Manuscript) => void;

  mode: PlaybackMode;
  selectMode: (mode: PlaybackMode) => void;

  voiceId: string;
  voices: Voice[];
  selectVoice: (id: string) => void;

  speed: number;
  setSpeed: (speed: number) => void;

  isBuffering: boolean;
  generationError: string | null;

  playback: ReturnType<typeof usePlayback>;

  sleepTimer: SleepTimerState;
  startSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [currentManuscript, setCurrentManuscript] = useState<Manuscript | null>(null);
  const [mode, setMode] = useState<PlaybackMode>("read");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [speed, setSpeedState] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const playback = usePlayback();

  const [sleepTimerState, setSleepTimerState] = useState<SleepTimerState>({ status: "off" });
  const [sleepTimer] = useState(() => new SleepTimer());
  useEffect(() => sleepTimer.subscribe(setSleepTimerState), [sleepTimer]);

  const refreshManuscripts = useCallback(async () => {
    setManuscripts(await db.listManuscripts());
  }, []);

  useEffect(() => {
    refreshManuscripts();
    // Once the model finishes loading we know the real voice list; refresh it then too.
    ensureModelReady()
      .then(() => setVoices(listVoices()))
      .catch(() => {});
  }, [refreshManuscripts]);

  useEffect(() => {
    db.getSetting<string | null>(LAST_OPENED_KEY, null).then(async (id) => {
      if (id) {
        const manuscript = await db.getManuscript(id);
        if (manuscript) setCurrentManuscript(manuscript);
      }
    });
  }, []);

  const generateAndQueue = useCallback(
    async (manuscript: Manuscript, requestedMode: PlaybackMode, voice: string, requestedSpeed: number) => {
      setIsBuffering(true);
      setGenerationError(null);
      try {
        let narrationText = manuscript.text;
        if (requestedMode !== "read") {
          const result = await generateScript(manuscript.text, manuscript.title, requestedMode);
          if (!result.ok) {
            setGenerationError(result.text);
            return;
          }
          narrationText = result.text;
        }

        // Reset the queue first, then stream chunks in via appendChunk as each one finishes
        // generating -- playback can start on chunk 0 before the rest of the text is synthesized.
        playback.controller.loadQueue([]);
        await synthesize(narrationText, voice, requestedSpeed, (blob) => {
          playback.controller.appendChunk(blob);
        });

        playback.controller.setMediaSessionMetadata(manuscript.title, manuscript.author ?? "SMR", manuscript.coverDataUrl);
        // Best-effort resume note: without per-chunk duration bookkeeping across a page reload,
        // we can't seek to an exact cross-chunk offset yet, so playback starts from chunk 0 --
        // the saved position is still tracked (below) for a future exact-resume pass.
      } catch (error) {
        setGenerationError(error instanceof Error ? error.message : "Narration failed");
      } finally {
        setIsBuffering(false);
      }
    },
    [playback.controller]
  );

  const openManuscript = useCallback(
    (manuscript: Manuscript) => {
      setCurrentManuscript(manuscript);
      db.putSetting(LAST_OPENED_KEY, manuscript.id);
      void generateAndQueue(manuscript, mode, voiceId, speed);
    },
    [generateAndQueue, mode, voiceId, speed]
  );

  const selectMode = useCallback(
    (nextMode: PlaybackMode) => {
      setMode(nextMode);
      if (currentManuscript) void generateAndQueue(currentManuscript, nextMode, voiceId, speed);
    },
    [currentManuscript, generateAndQueue, voiceId, speed]
  );

  const selectVoice = useCallback(
    (id: string) => {
      setVoiceId(id);
      if (currentManuscript) void generateAndQueue(currentManuscript, mode, id, speed);
    },
    [currentManuscript, generateAndQueue, mode, speed]
  );

  const setSpeed = useCallback(
    (next: number) => {
      setSpeedState(next);
      playback.controller.setSpeed(next);
    },
    [playback.controller]
  );

  const importManuscript = useCallback(
    async (file: File) => {
      const manuscript = await importPlainText(file);
      await db.putManuscript(manuscript);
      await refreshManuscripts();
    },
    [refreshManuscripts]
  );

  const deleteManuscriptFn = useCallback(
    async (id: string) => {
      await db.deleteManuscript(id);
      await refreshManuscripts();
      if (currentManuscript?.id === id) setCurrentManuscript(null);
    },
    [refreshManuscripts, currentManuscript]
  );

  const startSleepTimer = useCallback(
    (minutes: number) => {
      sleepTimer.start(minutes * 60_000, () => playback.controller.pause());
    },
    [sleepTimer, playback.controller]
  );

  const cancelSleepTimer = useCallback(() => sleepTimer.cancel(), [sleepTimer]);

  // Persist position periodically while playing (approximate, chunk-index based).
  useEffect(() => {
    if (!currentManuscript) return;
    const id = window.setInterval(() => {
      if (playback.state.isPlaying) {
        const approxSeconds = playback.state.chunkIndex * 20 + playback.state.currentTime;
        void db.savePosition(currentManuscript.id, approxSeconds * 1000);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [currentManuscript, playback.state.isPlaying, playback.state.chunkIndex, playback.state.currentTime]);

  const value = useMemo<AppStateValue>(
    () => ({
      manuscripts,
      refreshManuscripts,
      importManuscript,
      deleteManuscript: deleteManuscriptFn,
      currentManuscript,
      openManuscript,
      mode,
      selectMode,
      voiceId,
      voices,
      selectVoice,
      speed,
      setSpeed,
      isBuffering,
      generationError,
      playback,
      sleepTimer: sleepTimerState,
      startSleepTimer,
      cancelSleepTimer
    }),
    [
      manuscripts,
      refreshManuscripts,
      importManuscript,
      deleteManuscriptFn,
      currentManuscript,
      openManuscript,
      mode,
      selectMode,
      voiceId,
      voices,
      selectVoice,
      speed,
      setSpeed,
      isBuffering,
      generationError,
      playback,
      sleepTimerState,
      startSleepTimer,
      cancelSleepTimer
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
