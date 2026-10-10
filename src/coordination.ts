import { validateImport } from "./persistence";
import type { Store } from "./types";
export type Ownership = "connecting" | "owner" | "viewer" | "unsupported";
// Web Locks is origin-scoped, crash-safe, and atomically exclusive across tabs.
// BroadcastChannel carries changes locally; it never makes network requests.
export class RoomCoordinator {
  readonly id = crypto.randomUUID();
  private status: Ownership = "connecting";
  private listeners = new Set<() => void>();
  private stateListeners = new Set<(state: Store) => void>();
  private channel: BroadcastChannel | null = null;
  private release: (() => void) | null = null;
  private requesting = false;
  private disposed = false;
  private lastState: Store | null = null;
  onAcquire: (() => void) | null = null;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.status;
  get canWrite() {
    return this.status === "owner";
  }
  private setStatus(status: Ownership) {
    this.status = status;
    this.listeners.forEach((fn) => fn());
  }
  onState(fn: (state: Store) => void) {
    this.stateListeners.add(fn);
    return () => {
      this.stateListeners.delete(fn);
    };
  }
  start() {
    this.disposed = false;
    this.setStatus("connecting");
    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel("stillroom.room");
      this.channel.onmessage = (event) => {
        const message = event.data;
        if (message?.source === this.id) return;
        if (message?.type === "takeover" && this.canWrite) {
          this.setStatus("viewer");
          this.release?.();
          this.release = null;
        }
        if (message?.type === "state" && !this.canWrite) {
          try {
            const state = validateImport(message.state);
            this.stateListeners.forEach((fn) => fn(state));
          } catch {
            /* Ignore invalid messages from this origin. */
          }
        }
        if (
          message?.type === "request-state" &&
          this.canWrite &&
          this.lastState
        )
          this.publish(this.lastState);
      };
    }
    if (!navigator.locks) {
      this.setStatus("unsupported");
      return;
    }
    void this.acquire(false);
  }
  private async acquire(wait: boolean) {
    if (this.requesting || this.disposed) return;
    this.requesting = true;
    try {
      await navigator.locks.request(
        "stillroom.timer-owner",
        wait ? {} : { ifAvailable: true },
        async (lock) => {
          if (!lock || this.disposed) {
            if (!this.disposed) this.setStatus("viewer");
            return;
          }
          this.requesting = false;
          this.onAcquire?.();
          this.setStatus("owner");
          this.channel?.postMessage({ type: "owner", source: this.id });
          await new Promise<void>((resolve) => {
            this.release = resolve;
          });
          if (!this.disposed) this.setStatus("viewer");
        },
      );
    } catch {
      this.setStatus("unsupported");
    } finally {
      this.requesting = false;
    }
  }
  takeOver = () => {
    if (this.canWrite || this.disposed) return;
    this.channel?.postMessage({ type: "takeover", source: this.id });
    void this.acquire(true);
  };
  publish(state: Store) {
    this.lastState = state;
    if (this.canWrite)
      this.channel?.postMessage({ type: "state", source: this.id, state });
  }
  requestState() {
    this.channel?.postMessage({ type: "request-state", source: this.id });
  }
  close() {
    this.disposed = true;
    this.release?.();
    this.release = null;
    this.channel?.close();
    this.channel = null;
    this.setStatus("viewer");
  }
}
