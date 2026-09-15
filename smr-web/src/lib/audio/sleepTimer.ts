export type SleepTimerState = { status: "off" } | { status: "active"; remainingMs: number };

type Listener = (state: SleepTimerState) => void;

/** Simple countdown timer that invokes a callback once on expiry, matching the Android build's semantics. */
export class SleepTimer {
  private intervalId: number | null = null;
  private endsAt = 0;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  start(durationMs: number, onExpire: () => void) {
    this.cancel();
    this.endsAt = Date.now() + durationMs;
    this.intervalId = window.setInterval(() => {
      const remaining = this.endsAt - Date.now();
      if (remaining <= 0) {
        this.cancel();
        onExpire();
      } else {
        this.publish();
      }
    }, 1000);
    this.publish();
  }

  cancel() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.publish();
  }

  private snapshot(): SleepTimerState {
    if (this.intervalId === null) return { status: "off" };
    return { status: "active", remainingMs: Math.max(0, this.endsAt - Date.now()) };
  }

  private publish() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}
