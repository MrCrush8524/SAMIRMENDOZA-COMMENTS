export interface PlaybackState {
  isPlaying: boolean;
  chunkIndex: number;
  chunkCount: number;
  currentTime: number;
  duration: number;
  speed: number;
}

type Listener = (state: PlaybackState) => void;

const SKIP_SECONDS = 15;

/**
 * Plays a queue of narration WAV blobs sequentially through a single reused <audio> element,
 * advancing automatically at each chunk boundary. Publishes Media Session metadata/handlers so
 * lock-screen and notification-shade controls work in supporting browsers (this is the ceiling
 * of what background/lock-screen playback the web platform allows -- see the note in README
 * about how this differs from the Android build's real foreground service).
 */
export class PlaybackController {
  private audio = new Audio();
  private blobs: Blob[] = [];
  private objectUrls: string[] = [];
  private index = 0;
  private speed = 1;
  private listeners = new Set<Listener>();
  private onQueueFinished: (() => void) | null = null;

  constructor() {
    this.audio.addEventListener("timeupdate", () => this.publish());
    this.audio.addEventListener("loadedmetadata", () => this.publish());
    this.audio.addEventListener("play", () => this.publish());
    this.audio.addEventListener("pause", () => this.publish());
    this.audio.addEventListener("ended", () => this.advance());
    this.setupMediaSession();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private publish() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
    this.updateMediaSessionPositionState();
  }

  private snapshot(): PlaybackState {
    return {
      isPlaying: !this.audio.paused && !this.audio.ended,
      chunkIndex: this.index,
      chunkCount: this.blobs.length,
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration || 0,
      speed: this.speed
    };
  }

  /** Replaces the queue and starts loading (not playing) the first chunk. */
  loadQueue(blobs: Blob[], onFinished?: () => void) {
    this.revokeUrls();
    this.blobs = blobs;
    this.objectUrls = blobs.map((b) => URL.createObjectURL(b));
    this.index = 0;
    this.onQueueFinished = onFinished ?? null;
    if (this.objectUrls.length > 0) {
      this.audio.src = this.objectUrls[0];
      this.audio.playbackRate = this.speed;
    }
    this.publish();
  }

  /** Appends more chunks to the live queue as they finish synthesizing (streaming generation). */
  appendChunk(blob: Blob) {
    this.blobs.push(blob);
    this.objectUrls.push(URL.createObjectURL(blob));
    if (this.blobs.length === 1) {
      this.audio.src = this.objectUrls[0];
      this.audio.playbackRate = this.speed;
    }
    this.publish();
  }

  async play() {
    if (this.blobs.length === 0) return;
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  private advance() {
    if (this.index + 1 < this.blobs.length) {
      this.index += 1;
      this.audio.src = this.objectUrls[this.index];
      this.audio.playbackRate = this.speed;
      this.audio.play().catch(() => {});
    } else {
      this.publish();
      this.onQueueFinished?.();
    }
  }

  private goToChunk(index: number, timeInChunk: number, wasPlaying: boolean) {
    this.index = Math.max(0, Math.min(index, this.blobs.length - 1));
    this.audio.src = this.objectUrls[this.index];
    this.audio.playbackRate = this.speed;
    const seekOnceLoaded = () => {
      this.audio.currentTime = Math.max(0, timeInChunk);
      this.audio.removeEventListener("loadedmetadata", seekOnceLoaded);
      if (wasPlaying) this.audio.play().catch(() => {});
    };
    this.audio.addEventListener("loadedmetadata", seekOnceLoaded);
  }

  seekForward() {
    const wasPlaying = !this.audio.paused;
    const remaining = (this.audio.duration || 0) - this.audio.currentTime;
    if (remaining > SKIP_SECONDS || this.index === this.blobs.length - 1) {
      this.audio.currentTime = Math.min(this.audio.currentTime + SKIP_SECONDS, this.audio.duration || 0);
    } else {
      this.goToChunk(this.index + 1, SKIP_SECONDS - remaining, wasPlaying);
    }
  }

  seekBackward() {
    const wasPlaying = !this.audio.paused;
    if (this.audio.currentTime >= SKIP_SECONDS || this.index === 0) {
      this.audio.currentTime = Math.max(this.audio.currentTime - SKIP_SECONDS, 0);
    } else {
      const overflow = SKIP_SECONDS - this.audio.currentTime;
      // We don't know the previous chunk's duration until it loads; approximate by seeking to
      // its end once metadata is available, then subtracting the overflow.
      const prevIndex = this.index - 1;
      this.index = prevIndex;
      this.audio.src = this.objectUrls[prevIndex];
      this.audio.playbackRate = this.speed;
      const seekOnceLoaded = () => {
        this.audio.currentTime = Math.max(0, (this.audio.duration || 0) - overflow);
        this.audio.removeEventListener("loadedmetadata", seekOnceLoaded);
        if (wasPlaying) this.audio.play().catch(() => {});
      };
      this.audio.addEventListener("loadedmetadata", seekOnceLoaded);
    }
  }

  /** Scrubber drag: seeks within the currently-loaded chunk only (see class doc for why chunk
   *  boundaries, not an absolute cross-chunk position, are the unit of seeking here). */
  seekWithinChunk(seconds: number) {
    if (!this.audio.duration || !isFinite(this.audio.duration)) return;
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.audio.playbackRate = speed;
    this.publish();
  }

  /** Approximate absolute position across all chunks, for saved-position persistence. */
  approximateElapsedSeconds(chunkDurations: number[]): number {
    const priorChunks = chunkDurations.slice(0, this.index).reduce((a, b) => a + b, 0);
    return priorChunks + (this.audio.currentTime || 0);
  }

  private revokeUrls() {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  private setupMediaSession() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => this.play());
    navigator.mediaSession.setActionHandler("pause", () => this.pause());
    navigator.mediaSession.setActionHandler("seekforward", () => this.seekForward());
    navigator.mediaSession.setActionHandler("seekbackward", () => this.seekBackward());
  }

  setMediaSessionMetadata(title: string, artist: string, artworkUrl?: string) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      artwork: artworkUrl ? [{ src: artworkUrl, sizes: "512x512", type: "image/png" }] : []
    });
  }

  private updateMediaSessionPositionState() {
    if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
    const duration = this.audio.duration;
    if (!duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.speed,
        position: Math.min(this.audio.currentTime, duration)
      });
    } catch {
      // Some browsers throw if called with inconsistent values mid-transition; safe to ignore.
    }
  }
}
