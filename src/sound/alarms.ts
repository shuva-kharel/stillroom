import type { AlarmId, Preferences } from "../preferences";
import { getMedia } from "../media";
export const alarmChoices = [
  { value: "chime", label: "Soft Chime" },
  { value: "bell", label: "Bell" },
  { value: "digital", label: "Digital" },
  { value: "wood", label: "Wooden Tap" },
  { value: "bowl", label: "Singing Bowl" },
  { value: "rise", label: "Gentle Rise" },
  { value: "silent", label: "Silent" },
  { value: "custom", label: "Custom upload" },
];
export class AlarmEngine {
  private ctx: AudioContext | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private nodes = new Set<AudioNode>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private generation = 0;
  private listeners = new Set<() => void>();
  private revision = 0;
  active = false;
  constructor(private factory: () => AudioContext = () => new AudioContext()) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.revision;
  private emit() {
    this.revision++;
    this.listeners.forEach((fn) => fn());
  }
  async unlock() {
    this.ctx ??= this.factory();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }
  stop() {
    this.generation++;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* Ended. */
      }
      s.disconnect();
    });
    this.sources.clear();
    this.nodes.forEach((n) => n.disconnect());
    this.nodes.clear();
    this.active = false;
    this.emit();
  }
  async play(id: AlarmId, settings: Preferences["alarms"], preview = false) {
    this.stop();
    if (id === "silent" || settings.volume === 0) return;
    const token = this.generation;
    const ctx = await this.unlock();
    let buffer: AudioBuffer | undefined;
    if (id === "custom") {
      const media = await getMedia(settings.mediaId);
      if (!media)
        throw new Error(
          "Custom alarm is missing on this device. Choose another alarm or upload it again.",
        );
      buffer = await ctx.decodeAudioData(await media.blob.arrayBuffer());
    }
    if (token !== this.generation) return;
    this.active = true;
    this.emit();
    const count = preview ? 1 : Math.max(1, Math.min(5, settings.repeat));
    const duration = buffer
      ? Math.min(buffer.duration, 30)
      : id === "bowl" || id === "rise"
        ? 3
        : 1.5;
    for (let i = 0; i < count; i++) {
      const at = ctx.currentTime + i * (duration + 0.5);
      const master = ctx.createGain();
      this.nodes.add(master);
      master.connect(ctx.destination);
      const amplitude = settings.volume * 0.22;
      master.gain.setValueAtTime(settings.fade ? 0 : amplitude, at);
      if (settings.fade)
        master.gain.linearRampToValueAtTime(amplitude, at + 0.6);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(master);
        this.sources.add(source);
        source.start(at, 0, duration);
        source.onended = () => {
          source.disconnect();
          this.sources.delete(source);
        };
      } else {
        const tones =
          id === "chime"
            ? [523.25, 659.25]
            : id === "bell"
              ? [740, 1481, 2215]
              : id === "digital"
                ? [880, 880, 1100]
                : id === "wood"
                  ? [360]
                  : id === "bowl"
                    ? [220, 442, 664]
                    : [330, 440, 550, 660];
        tones.forEach((frequency, j) => {
          const o = ctx.createOscillator(),
            g = ctx.createGain();
          this.nodes.add(g);
          this.sources.add(o);
          o.type = id === "digital" ? "square" : "sine";
          o.frequency.setValueAtTime(frequency, at);
          if (id === "wood")
            o.frequency.exponentialRampToValueAtTime(110, at + 0.1);
          const start = at + (id === "bell" || id === "bowl" ? 0 : j * 0.17);
          const length =
            id === "wood"
              ? 0.13
              : id === "digital"
                ? 0.12
                : duration - j * 0.17;
          o.connect(g);
          g.connect(master);
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(1 / tones.length, start + 0.01);
          g.gain.exponentialRampToValueAtTime(
            0.001,
            start + Math.max(0.05, length),
          );
          o.start(start);
          o.stop(start + length + 0.02);
          o.onended = () => {
            o.disconnect();
            g.disconnect();
            this.sources.delete(o);
            this.nodes.delete(g);
          };
        });
      }
    }
    const timer = setTimeout(
      () => {
        this.timers.delete(timer);
        if (token === this.generation) this.stop();
      },
      (duration + 0.5) * count * 1000,
    );
    this.timers.add(timer);
  }
  close() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
export const alarms = new AlarmEngine();
