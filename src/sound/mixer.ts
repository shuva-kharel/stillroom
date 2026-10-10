import type { SoundId } from "../preferences";
import { synthesize } from "./synthesis";
type Track = { source: AudioBufferSourceNode; gain: GainNode };
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private safety: GainNode | null = null;
  private tracks = new Map<SoundId, Track>();
  private tokens = new Map<SoundId, number>();
  private listeners = new Set<() => void>();
  private revision = 0;
  private cleanupTimers = new Map<ReturnType<typeof setTimeout>, () => void>();
  private buffers = new Map<SoundId, AudioBuffer>();
  private fading: ReturnType<typeof setTimeout> | null = null;
  masterVolume = 0.6;
  muted = false;
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
  get active() {
    return [...this.tracks.keys()];
  }
  async ready() {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = this.factory();
      this.master = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -12;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.2;
      this.safety = this.ctx.createGain();
      this.safety.gain.value = 0.35;
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      this.master.connect(this.limiter);
      this.limiter.connect(this.safety);
      this.safety.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }
  async start(id: SoundId, volume: number) {
    const token = (this.tokens.get(id) ?? 0) + 1;
    this.tokens.set(id, token);
    const ctx = await this.ready();
    if (
      this.tokens.get(id) !== token ||
      ctx !== this.ctx ||
      ctx.state === "closed"
    )
      return;
    if (this.tracks.has(id)) {
      this.setVolume(id, volume);
      return;
    }
    let buffer = this.buffers.get(id);
    if (!buffer) {
      const data = synthesize(id, ctx.sampleRate);
      buffer = ctx.createBuffer(data.length, data[0].length, ctx.sampleRate);
      data.forEach((channel, i) => buffer!.getChannelData(i).set(channel));
      this.buffers.set(id, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0.08;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.65);
    source.connect(gain);
    gain.connect(this.master!);
    this.tracks.set(id, { source, gain });
    source.start();
    this.emit();
  }
  setVolume(id: SoundId, value: number) {
    const track = this.tracks.get(id);
    if (track && this.ctx) {
      track.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      track.gain.gain.setTargetAtTime(value * 0.3, this.ctx.currentTime, 0.12);
    }
  }
  setMaster(value: number) {
    this.masterVolume = value;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : value,
        this.ctx.currentTime,
        0.15,
      );
    this.emit();
  }
  mute(value: boolean) {
    this.muted = value;
    this.setMaster(this.masterVolume);
  }
  stop(id: SoundId, immediate = false) {
    this.tokens.set(id, (this.tokens.get(id) ?? 0) + 1);
    const t = this.tracks.get(id);
    if (!t) return;
    this.tracks.delete(id);
    if (this.ctx) {
      t.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      t.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
    }
    const cleanup = () => {
      try {
        t.source.stop();
      } catch {
        /* Already stopped. */
      }
      t.source.disconnect();
      t.gain.disconnect();
    };
    if (immediate) cleanup();
    else {
      const timer = setTimeout(() => {
        cleanup();
        this.cleanupTimers.delete(timer);
      }, 350);
      this.cleanupTimers.set(timer, cleanup);
    }
    this.emit();
  }
  stopAll(immediate = false) {
    if (this.fading) {
      clearTimeout(this.fading);
      this.fading = null;
    }
    for (const id of new Set([...this.tokens.keys(), ...this.tracks.keys()]))
      this.stop(id, immediate);
    this.setMaster(this.masterVolume);
  }
  finish(behavior: "continue" | "fade" | "pause") {
    if (behavior === "continue") return;
    if (behavior === "pause") {
      this.stopAll();
      return;
    }
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
      if (this.fading) clearTimeout(this.fading);
      this.fading = setTimeout(() => {
        this.fading = null;
        this.stopAll();
      }, 4500);
    }
  }
  close() {
    this.stopAll(true);
    this.cleanupTimers.forEach((cleanup, timer) => {
      clearTimeout(timer);
      cleanup();
    });
    this.cleanupTimers.clear();
    this.master?.disconnect();
    this.limiter?.disconnect();
    this.safety?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.safety = null;
    this.buffers.clear();
  }
}
export const mixer = new AudioMixer();
