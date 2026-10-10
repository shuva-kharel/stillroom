import { describe, expect, it } from "vitest";
import { exportSnapshot, validateImport } from "./persistence";
import { initialStore, transition } from "./timer";
describe("versioned JSON validation", () => {
  it("exports live focus time in a paused snapshot without changing the running room", () => {
    const s = transition(initialStore(), { type: "toggle" }, 1000);
    const snapshot = exportSnapshot(s, 61000);
    expect(snapshot.timer.elapsed).toBe(60000);
    expect(snapshot.timer.runningSince).toBeNull();
    expect(s.timer.runningSince).toBe(1000);
    expect(validateImport(snapshot).timer.segments).toEqual([
      { start: 1000, end: 61000 },
    ]);
  });
  it("round trips a complete room with a running timer and real history", () => {
    let s = transition(initialStore(), { type: "toggle" }, 1000);
    s = transition(s, { type: "reset" }, 31000);
    s = transition(s, { type: "toggle" }, 40000);
    expect(validateImport(JSON.parse(JSON.stringify(s)))).toEqual({
      ...s,
      notice: "",
    });
  });
  it.each([
    null,
    {},
    { version: 2 },
    { ...initialStore(), settings: { focus: 0 } },
    { ...initialStore(), history: [{}] },
    { ...initialStore(), timer: { ...initialStore().timer, elapsed: -1 } },
    { ...initialStore(), notes: { bad: 12 } },
    {
      ...initialStore(),
      tasks: [
        { id: "x", title: "x", subjectId: "", estimate: 1, done: true },
        { id: "x", title: "x", subjectId: "", estimate: 1, done: true },
      ],
    },
  ])("rejects malformed or inconsistent data", (value) => {
    expect(() => validateImport(value)).toThrow();
  });
  it("rejects history with inflated focus time", () => {
    let s = transition(initialStore(), { type: "toggle" }, 1000);
    s = transition(s, { type: "reset" }, 31000);
    s.history[0].duration = 999999;
    expect(() => validateImport(s)).toThrow("invalid history");
  });
});
