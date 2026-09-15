export interface Manuscript {
  id: string;
  title: string;
  author?: string;
  sourceFileName: string;
  text: string;
  coverDataUrl?: string;
  coverIsFallback: boolean;
  importedAtEpochMs: number;
  wordCount: number;
  durationEstimateSeconds: number;
}

export type PlaybackMode = "read" | "retell" | "summary" | "podcast";

export const PLAYBACK_MODE_LABEL: Record<PlaybackMode, string> = {
  read: "Read",
  retell: "Retell",
  summary: "Summary",
  podcast: "Podcast"
};

export interface Voice {
  id: string;
  displayName: string;
}

export const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
export const SLEEP_TIMER_PRESETS_MIN = [5, 10, 15, 30, 45, 60];
export const SKIP_INTERVAL_SECONDS = 15;

export type ModelLoadState =
  | { status: "not-started" }
  | { status: "loading"; progress: number; file: string }
  | { status: "ready" }
  | { status: "failed"; message: string };
