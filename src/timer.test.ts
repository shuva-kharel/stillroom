import { describe, expect, it } from "vitest";
import {
  activeSegments,
  elapsed,
  formatClock,
  initialStore,
  remaining,
  timeOnDay,
  transition,
} from "./timer";

describe("timestamp-based timer", () => {
  it("rounds countdowns up and stopwatch elapsed seconds down", () => {
    expect(formatClock(999)).toBe("00:01");
    expect(formatClock(999, true)).toBe("00:00");
    expect(formatClock(10100, true)).toBe("00:10");
  });
  it("derives remaining time from timestamps, without ticks", () => {
    const state = transition(initialStore(), { type: "toggle" }, 1000);
    expect(remaining(state.timer, 91000)).toBe(24 * 60000 - 30000);
    expect(elapsed(state.timer, 61000)).toBe(60000);
  });
  it("excludes all paused time, including after JSON recovery", () => {
    let state = transition(initialStore(), { type: "toggle" }, 1000);
    state = transition(state, { type: "toggle" }, 61000);
    expect(elapsed(state.timer, 86400000)).toBe(60000);
    state = JSON.parse(JSON.stringify(state));
    state = transition(state, { type: "toggle" }, 86400000);
    expect(elapsed(state.timer, 86430000)).toBe(90000);
    state = transition(state, { type: "reset" }, 86430000);
    expect(state.history[0].duration).toBe(90000);
    expect(state.history[0].segments).toEqual([
      { start: 1000, end: 61000 },
      { start: 86400000, end: 86430000 },
    ]);
    expect(state.history[0].completed).toBe(false);
  });
  it("resolves a slept-through deadline only once and never chains sessions", () => {
    let state = initialStore();
    state.settings.autoStart = true;
    state = transition(state, { type: "toggle" }, 1000);
    const recovery = 1000 + 12 * 3600000;
    state = transition(
      JSON.parse(JSON.stringify(state)),
      { type: "tick" },
      recovery,
    );
    expect(state.history).toHaveLength(1);
    expect(state.history[0].duration).toBe(25 * 60000);
    expect(state.history[0].endedAt).toBe(1501000);
    expect(state.history[0].completed).toBe(true);
    expect(state.timer.mode).toBe("short");
    expect(state.timer.runningSince).toBeNull();
    state = transition(state, { type: "tick" }, recovery + 3600000);
    expect(state.history).toHaveLength(1);
  });
  it("auto-starts only on a timely, visible completion", () => {
    let s = initialStore();
    s.settings.autoStart = true;
    s = transition(s, { type: "toggle" }, 0);
    const visible = transition(s, { type: "tick" }, 1500100, true);
    expect(visible.timer.runningSince).toBe(1500000);
    const hidden = transition(s, { type: "tick" }, 1500100, false);
    expect(hidden.timer.runningSince).toBeNull();
  });
  it("records partial work exactly once on reset, skip, or mode change", () => {
    for (const action of [
      { type: "reset" },
      { type: "skip" },
      { type: "mode", mode: "long" },
    ] as const) {
      let s = transition(initialStore(), { type: "toggle" }, 0);
      s = transition(s, action, 45000);
      expect(s.history).toHaveLength(1);
      expect(s.history[0].duration).toBe(45000);
      expect(s.history[0].completed).toBe(false);
      s = transition(s, { type: "reset" }, 50000);
      expect(s.history).toHaveLength(1);
    }
  });
  it("does not count break time or empty timers as study", () => {
    let s = transition(initialStore(), { type: "reset" }, 0);
    s = transition(s, { type: "mode", mode: "short" }, 0);
    s = transition(s, { type: "toggle" }, 1000);
    s = transition(s, { type: "tick" }, 301000);
    expect(s.history).toHaveLength(0);
    expect(s.timer.mode).toBe("focus");
  });
  it("counts only completed focus sessions toward the long-break frequency", () => {
    let s = initialStore();
    s.settings.frequency = 2;
    s = transition(s, { type: "toggle" }, 0);
    s = transition(s, { type: "tick" }, 1500000);
    expect(s.timer.mode).toBe("short");
    s = transition(s, { type: "skip" }, 1501000);
    s = transition(s, { type: "toggle" }, 1502000);
    s = transition(s, { type: "skip" }, 1562000);
    expect(s.timer.cycle).toBe(1);
    s = transition(s, { type: "skip" }, 1563000);
    s = transition(s, { type: "toggle" }, 1564000);
    s = transition(s, { type: "tick" }, 3064000);
    expect(s.timer.mode).toBe("long");
    expect(s.timer.cycle).toBe(2);
    expect(s.history.filter((x) => x.completed)).toHaveLength(2);
  });
  it("saves the old subject before changing subjects", () => {
    let s = initialStore();
    s.subjects = [{ id: "math", name: "Mathematics", color: "#abcdef" }];
    s = transition(s, { type: "subject", subjectId: "math" }, 0);
    s = transition(s, { type: "toggle" }, 1000);
    s = transition(s, { type: "subject", subjectId: "" }, 31000);
    expect(s.history[0].subjectName).toBe("Mathematics");
    expect(s.history[0].duration).toBe(30000);
    expect(s.timer.subjectId).toBe("");
    expect(s.timer.runningSince).toBeNull();
  });
  it("supports open-ended stopwatch study without fabricating completed pomodoros", () => {
    let s = transition(initialStore(), { type: "mode", mode: "stopwatch" }, 0);
    s = transition(s, { type: "toggle" }, 1000);
    s = transition(s, { type: "tick" }, 7201000);
    expect(elapsed(s.timer, 7201000)).toBe(7200000);
    s = transition(s, { type: "reset" }, 7201000);
    expect(s.history[0].completed).toBe(false);
    expect(s.history[0].duration).toBe(7200000);
  });
  it("splits focus time correctly across local midnight and excludes pause intervals", () => {
    const start = new Date(2026, 9, 10, 23, 55).getTime();
    let s = transition(initialStore(), { type: "toggle" }, start);
    s = transition(s, { type: "toggle" }, start + 600000);
    expect(
      timeOnDay(
        activeSegments(s.timer, start + 7200000),
        new Date(2026, 9, 10),
      ),
    ).toBe(300000);
    expect(
      timeOnDay(
        activeSegments(s.timer, start + 7200000),
        new Date(2026, 9, 11),
      ),
    ).toBe(300000);
  });
  it("handles late reset without losing a completed session", () => {
    let s = transition(initialStore(), { type: "toggle" }, 1000);
    s = transition(s, { type: "reset" }, 2000000);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].completed).toBe(true);
    expect(s.history[0].duration).toBe(1500000);
  });
  it("does not turn backward clock adjustments into negative study time", () => {
    const s = transition(initialStore(), { type: "toggle" }, 5000);
    expect(elapsed(s.timer, 2000)).toBe(0);
  });
});
