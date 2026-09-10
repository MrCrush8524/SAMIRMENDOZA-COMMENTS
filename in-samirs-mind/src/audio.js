// Central audio manager: menu loop, main soundtrack, Dream Track ducking,
// TV broadcast ducking. Everything routes through a single "music" channel
// so only one thing ever needs to fade at a time.

const FADE_MS = 650;

function fade(audio, from, to, ms, onDone) {
  const start = performance.now();
  audio.volume = from;
  function step(now) {
    const t = Math.min(1, (now - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
    else onDone && onDone();
  }
  requestAnimationFrame(step);
}

export class AudioManager {
  constructor() {
    this.menu = new Audio('assets/audio/menu/menu_loop.opus');
    this.menu.loop = true;
    this.menu.volume = 0;

    this.main = new Audio('assets/audio/main_soundtrack/main_soundtrack.opus');
    this.main.loop = true;
    this.main.volume = 0;

    this.dreamTrack = null;
    this.resumeMainAt = null;
    this.mainWasPlaying = false;
  }

  playMenu() {
    this.main.pause();
    this.menu.currentTime = this.menu.currentTime || 0;
    this.menu.play().catch(() => {});
    fade(this.menu, this.menu.volume, 0.6, FADE_MS);
  }

  stopMenu() {
    fade(this.menu, this.menu.volume, 0, FADE_MS, () => this.menu.pause());
  }

  playMain() {
    this.main.play().catch(() => {});
    fade(this.main, this.main.volume, 0.55, FADE_MS);
  }

  pauseMain() {
    fade(this.main, this.main.volume, 0, FADE_MS, () => this.main.pause());
  }

  /** Duck main soundtrack for a TV broadcast; returns the <video> caller should play. */
  duckForBroadcast() {
    this.mainWasPlaying = !this.main.paused;
    this.resumeMainAt = this.main.currentTime;
    fade(this.main, this.main.volume, 0, FADE_MS, () => this.main.pause());
  }

  resumeAfterBroadcast() {
    if (!this.mainWasPlaying) return;
    this.main.currentTime = this.resumeMainAt || 0;
    this.main.play().catch(() => {});
    fade(this.main, 0, 0.55, FADE_MS);
  }

  /** Dream Track pickup: PLAY NOW pauses main at exact position, plays track, resumes. */
  playDreamTrackNow(src, onEnded) {
    this.resumeMainAt = this.main.currentTime;
    this.mainWasPlaying = !this.main.paused;
    fade(this.main, this.main.volume, 0, FADE_MS, () => {
      this.main.pause();
      this.dreamTrack = new Audio(src);
      this.dreamTrack.volume = 0.7;
      this.dreamTrack.play().catch(() => {});
      this.dreamTrack.addEventListener('ended', () => {
        this.resumeAfterBroadcast();
        onEnded && onEnded();
      });
    });
  }

  playOneShot(src, volume = 0.6) {
    const a = new Audio(src);
    a.volume = volume;
    a.play().catch(() => {});
    return a;
  }
}
