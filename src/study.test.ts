import { describe, expect, it } from "vitest";
import { initialStore, transition, elapsed } from "./timer";
import {
  resumeStudy,
  attachReflection,
  completeTask,
  addDays,
  weekBounds,
  studyWithin,
  calendarDate,
  type Practice,
} from "./study";
import { validateImport } from "./persistence";
import { portableRoom, parsePortableRoom } from "./portableRoom";
import { applyRoom } from "./roomPresets";
const practice: Practice = {
  name: "Algebra",
  subjectId: "",
  minutes: 1,
  questions: 10,
  done: 0,
  sections: [],
  checkpoint: 0,
  sound: false,
  passed: 0,
};
describe("study extensions", () => {
  it("resumes an active session without replacing its timer or records", () => {
    const s = transition(initialStore(), { type: "toggle" }, 1000);
    const n = resumeStudy(s);
    expect(n.timer).toBe(s.timer);
    expect(n.history).toBe(s.history);
  });
  it("prepares a paused fresh session and tolerates deleted context", () => {
    const s = initialStore();
    s.study.last = {
      subjectId: "deleted",
      taskId: "gone",
      roomId: "gone",
      intention: "private",
      mode: "countdown",
      duration: 2700000,
    };
    const n = resumeStudy(s);
    expect(n.timer.runningSince).toBeNull();
    expect(n.timer.duration).toBe(2700000);
    expect(n.timer.subjectId).toBe("");
    expect(n.timer.intention).toBe("");
    expect(n.history).toHaveLength(0);
  });
  it("captures context only when study is explicitly started", () => {
    let s = initialStore();
    s.timer.intention = "Read";
    s = transition(s, { type: "toggle" }, 1000);
    expect(s.study.last?.intention).toBe("Read");
    s = transition(s, { type: "reset" }, 6000);
    s = resumeStudy(s);
    expect(s.timer.runningSince).toBeNull();
    expect(s.timer.intention).toBe("Read");
  });
  it("records practice once, excludes pauses and never advances Pomodoro cycles", () => {
    let s = transition(
      initialStore(),
      { type: "practice", config: practice },
      1000,
    );
    s = transition(s, { type: "toggle" }, 11000);
    s = transition(s, { type: "toggle" }, 91000);
    s = transition(s, { type: "tick" }, 141000);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].mode).toBe("practice");
    expect(s.history[0].duration).toBe(60000);
    expect(s.timer.cycle).toBe(0);
    s = transition(s, { type: "tick" }, 99999999);
    expect(s.history).toHaveLength(1);
  });
  it("saves early practice as partial and does not duplicate on repeated finish", () => {
    let s = transition(
      initialStore(),
      { type: "practice", config: practice },
      1000,
    );
    s = transition(s, { type: "finish-practice" }, 21000);
    s = transition(s, { type: "finish-practice" }, 22000);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].duration).toBe(20000);
    expect(s.history[0].completed).toBe(false);
  });
  it("attaches and edits reflection without recording another session", () => {
    let s = transition(
      initialStore(),
      { type: "practice", config: practice },
      1000,
    );
    s = transition(s, { type: "finish-practice" }, 21000);
    const r = {
      finished: "Paper",
      next: "Review Q3",
      rating: "mixed" as const,
      score: "8/10",
    };
    const n = attachReflection(s, s.history[0].id, r);
    expect(n.history).toBe(s.history);
    expect(n.study.reflections[s.history[0].id]).toEqual(r);
    expect(attachReflection(n, "missing", r)).toBe(n);
  });
  it("preserves immutable completion snapshots and does not fabricate old dates", () => {
    const s = initialStore();
    s.tasks = [
      { id: "a", title: "Read", done: false, subjectId: "", estimate: 1 },
      { id: "old", title: "Old", done: true, subjectId: "", estimate: 0 },
    ];
    const n = completeTask(s, "a", 1000);
    expect(n.study.completions).toHaveLength(1);
    expect(n.tasks[0].completedAt).toBe(1000);
    expect(n.tasks[1].completedAt).toBeUndefined();
    expect(completeTask(n, "a", 2000)).toBe(n);
  });
  it("uses calendar arithmetic and configurable local week boundaries", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(calendarDate("2026-02-31")).toBe(false);
    const monday = weekBounds(new Date(2026, 9, 11, 12).getTime(), 1);
    expect(monday.key).toBe("2026-10-05");
    expect(weekBounds(new Date(2026, 9, 11, 12).getTime(), 0).key).toBe(
      "2026-10-11",
    );
  });
  it("splits actual time at weekly boundaries instead of assigning by completion date", () => {
    const w = weekBounds(new Date(2026, 9, 7).getTime(), 1);
    let s = transition(
      initialStore(),
      { type: "mode", mode: "stopwatch" },
      w.start - 60000,
    );
    s = transition(s, { type: "toggle" }, w.start - 60000);
    s = transition(s, { type: "reset" }, w.start + 60000);
    expect(studyWithin(s, w.start, w.end)).toBe(60000);
  });
  it("migrates v1/v2 without losing study data or active deadlines", () => {
    let s = transition(initialStore(), { type: "toggle" }, 1000);
    s.notes = { "": "Keep me" };
    for (const version of [1, 2]) {
      const n = validateImport({ ...s, version, study: undefined });
      expect(n.notes).toEqual(s.notes);
      expect(n.timer.runningSince).toBe(1000);
      expect(elapsed(n.timer, 3000)).toBe(2000);
      expect(n.study.reviews).toEqual([]);
      expect(n.version).toBe(3);
    }
  });
  it("round trips new study data and rejects malformed review dates", () => {
    const s = initialStore();
    s.study.reviews = [
      {
        id: "r",
        title: "Topic",
        subjectId: "",
        taskId: "",
        source: "topic",
        due: "2026-10-12",
        completedAt: null,
      },
    ];
    expect(validateImport(s).study).toEqual(s.study);
    s.study.reviews[0].due = "2026-02-31";
    expect(() => validateImport(s)).toThrow();
  });
  it("portable rooms exclude private data and cannot mutate timer state", () => {
    const s = transition(initialStore(), { type: "toggle" }, 1000);
    s.notes = { "": "SECRET_NOTE" };
    s.preferences.layout.greeting = "SECRET_GREETING";
    s.preferences.spotify.favorites = [
      { id: "playlist:1234567890123456789012", name: "SECRET_LINK" },
    ];
    s.preferences.background.type = "upload";
    s.preferences.background.mediaId = "SECRET_MEDIA";
    const exported = portableRoom(s);
    expect(JSON.stringify(exported)).not.toContain("SECRET");
    const room = parsePortableRoom(exported);
    const n = applyRoom(s, room);
    expect(n.timer).toBe(s.timer);
    expect(n.history).toBe(s.history);
    expect(n.notes).toBe(s.notes);
    expect(() =>
      parsePortableRoom({
        ...exported,
        room: { ...room, display: { ...room.display, style: "<script>" } },
      }),
    ).toThrow();
  });
  it("independent countdowns and laps do not duplicate Pomodoro records", () => {
    let s = initialStore();
    s.settings.countdown = 2;
    s = transition(s, { type: "mode", mode: "countdown" }, 0);
    s = transition(s, { type: "toggle" }, 1000);
    s = transition(s, { type: "tick" }, 3000);
    expect(s.history).toHaveLength(1);
    expect(s.timer.cycle).toBe(0);
    s = transition(s, { type: "mode", mode: "stopwatch" }, 3000);
    s = transition(s, { type: "toggle" }, 4000);
    s = transition(s, { type: "lap", label: "First" }, 5000);
    s = transition(s, { type: "lap", label: "Second" }, 6000);
    s = transition(s, { type: "reset" }, 7000);
    expect(s.history).toHaveLength(2);
    expect(s.history[1].duration).toBe(3000);
  });
});
