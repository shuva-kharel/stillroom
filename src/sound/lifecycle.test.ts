import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioMixer } from "./mixer";
import { AlarmEngine } from "./alarms";
import { synthesize } from "./synthesis";
import { defaultPreferences, soundIds } from "../preferences";
function mockContext() {
  const nodes: any[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => {
    const n = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: param(),
      frequency: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    };
    nodes.push(n);
    return n;
  };
  const ctx = {
    state: "running",
    sampleRate: 8000,
    currentTime: 0,
    destination: {},
    createGain: node,
    createDynamicsCompressor: node,
    createBufferSource: node,
    createOscillator: node,
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    resume: vi.fn(),
    close: vi.fn(),
  };
  return { ctx: ctx as unknown as AudioContext, nodes };
}
afterEach(() => vi.useRealTimers());
describe("audio lifecycle", () => {
  it("uses distinct finite, bounded profiles for all twelve ambience tracks", () => {
    const hashes = new Set<string>();
    for (const id of soundIds) {
      const channels = synthesize(id, 8000);
      expect(channels.length).toBe(id === "theta" ? 2 : 1);
      const samples = channels[0];
      expect(samples.every(Number.isFinite)).toBe(true);
      expect(
        Math.max(...samples.subarray(0, 10000).map(Math.abs)),
      ).toBeLessThanOrEqual(1);
      hashes.add(Array.from(samples.subarray(2000, 2020)).join(","));
    }
    expect(hashes.size).toBe(12);
  });
  it("prevents duplicate sources and cleans fading and pending tracks on close", async () => {
    vi.useFakeTimers();
    const { ctx, nodes } = mockContext();
    const m = new AudioMixer(() => ctx);
    await Promise.all([m.start("rain", 0.4), m.start("rain", 0.4)]);
    expect(m.active).toEqual(["rain"]);
    expect(nodes.filter((n) => n.start.mock.calls.length)).toHaveLength(1);
    await m.start("forest", 0.3);
    m.setMaster(0.5);
    m.mute(true);
    m.stop("rain");
    m.close();
    expect(m.active).toEqual([]);
    for (const source of nodes.filter((n) => n.start.mock.calls.length)) {
      expect(source.stop).toHaveBeenCalledTimes(1);
      expect(source.disconnect).toHaveBeenCalled();
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });
  it("cancels pending start requests before creating an orphan source", async () => {
    const { ctx, nodes } = mockContext();
    const m = new AudioMixer(() => ctx);
    const pending = m.start("brown", 0.4);
    m.stopAll();
    await pending;
    expect(nodes.filter((n) => n.start.mock.calls.length)).toHaveLength(0);
    m.close();
  });
  it("bounds alarm repetition, previews once, and dismisses all scheduled nodes", async () => {
    vi.useFakeTimers();
    const { ctx, nodes } = mockContext();
    const a = new AlarmEngine(() => ctx),
      settings = { ...defaultPreferences().alarms, repeat: 5 };
    await a.play("wood", settings, true);
    expect(nodes.filter((n) => n.start.mock.calls.length)).toHaveLength(1);
    a.stop();
    expect(a.active).toBe(false);
    await a.play("wood", settings);
    expect(nodes.filter((n) => n.start.mock.calls.length)).toHaveLength(6);
    await vi.runAllTimersAsync();
    expect(a.active).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    a.close();
  });
});
