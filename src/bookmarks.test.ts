import { describe, it, expect } from "vitest";
import {
  bookmarkSchema,
  bookmarkSubject,
  currentBookmark,
  removeBookmark,
  saveBookmark,
  validResourceUrl,
  type StudyBookmark,
} from "./bookmarks";
import { initialStore, transition } from "./timer";
import { attachReflection, resumePreview, resumeStudy } from "./study";
import { validateImport, exportSnapshot } from "./persistence";
import { portableRoom } from "./portableRoom";
import { builtinRooms } from "./roomPresets";

const bookmark: StudyBookmark = {
  id: "place",
  label: "Integration",
  resource: "Anton Calculus",
  location: "Page 42 · question 7",
  url: "https://example.org/book",
  subjectId: "math",
  taskId: "task",
};
function room() {
  const s = initialStore();
  s.subjects = [{ id: "math", name: "Maths", color: "#abcdef" }];
  s.tasks = [
    {
      id: "task",
      title: "Integration questions",
      subjectId: "math",
      estimate: 1,
      done: false,
    },
  ];
  return s;
}
describe("everyday study continuity", () => {
  it("adds, edits, selects and removes a place without touching an active timer or history", () => {
    const s = transition(room(), { type: "toggle" }, 1000);
    let n = saveBookmark(s, bookmark, true);
    n = saveBookmark(n, { ...bookmark, location: "Question 8" }, true);
    expect(n.study.bookmarks).toHaveLength(1);
    expect(currentBookmark(n, "math", "task")?.location).toBe("Question 8");
    expect(n.timer).toBe(s.timer);
    expect(n.history).toBe(s.history);
    n = removeBookmark(n, bookmark.id);
    expect(currentBookmark(n, "math")).toBeUndefined();
    expect(n.study.bookmarks).toEqual([]);
  });
  it("preserves old v3 history/reflections/timer and adds empty bookmark defaults", () => {
    let s = transition(room(), { type: "toggle" }, 1000);
    s = transition(s, { type: "reset" }, 6000);
    s = attachReflection(s, s.history[0].id, {
      finished: "12 questions",
      next: "Question 13",
      rating: "mixed",
      score: "",
    });
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.study.bookmarks;
    delete raw.study.currentBookmarks;
    const migrated = validateImport(raw);
    expect(migrated.history).toEqual(s.history);
    expect(migrated.study.reflections).toEqual(s.study.reflections);
    expect(migrated.timer).toEqual(s.timer);
    expect(migrated.study.bookmarks).toEqual([]);
  });
  it("backs up places and accomplishments but excludes both from portable rooms", () => {
    let s = saveBookmark(room(), bookmark, true);
    s = transition(
      transition(s, { type: "toggle" }, 1000),
      { type: "reset" },
      6000,
    );
    s = attachReflection(s, s.history[0].id, {
      finished: "SECRET accomplishment",
      next: "SECRET next",
      rating: "",
      score: "",
    });
    const restored = validateImport(
      JSON.parse(JSON.stringify(exportSnapshot(s))),
    );
    expect(restored.study).toEqual(s.study);
    const shared = JSON.stringify(portableRoom(s));
    expect(shared).not.toContain("SECRET");
    expect(shared).not.toContain("Anton Calculus");
    expect(shared).not.toContain("bookmarks");
  });
  it("restores subject, unfinished task, mode, duration, preset and current-place preview", () => {
    const s = saveBookmark(room(), bookmark, true);
    s.study.last = {
      subjectId: "math",
      taskId: "task",
      mode: "countdown",
      duration: 2700000,
      roomId: builtinRooms[0].id,
      intention: "",
    };
    const next = resumeStudy(s);
    expect(next.timer).toMatchObject({
      subjectId: "math",
      taskId: "task",
      mode: "countdown",
      duration: 2700000,
      runningSince: null,
    });
    expect(next.study.selectedRoom).toBe(builtinRooms[0].id);
    expect(resumePreview(s)).toContain("Page 42 · question 7");
    expect(resumePreview(s)).toContain(builtinRooms[0].name);
    s.subjects.push({ id: "physics", name: "Physics", color: "#abcdef" });
    s.tasks[0].subjectId = "physics";
    expect(resumeStudy(s).timer.subjectId).toBe("physics");
    expect(resumePreview(s)).toContain("Physics");
    s.tasks[0].done = true;
    expect(resumeStudy(s).timer.taskId).toBe("");
    s.subjects = [];
    s.tasks = [];
    s.study.last.roomId = "deleted";
    expect(resumeStudy(s).timer.subjectId).toBe("");
    expect(bookmarkSubject(s, bookmark)).toBe("");
  });
  it("does not replace an active session or suggest a different task's place", () => {
    const s = transition(
      saveBookmark(room(), bookmark, true),
      { type: "toggle" },
      1000,
    );
    const n = resumeStudy(s);
    expect(n.timer).toBe(s.timer);
    expect(n.history).toBe(s.history);
    expect(currentBookmark(s, "math", "other-task")).toBeUndefined();
  });
  it("rejects unsafe URLs and duplicate bookmark IDs in backups", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///etc/passwd",
      "https://user:pass@example.org",
      "not a URL",
    ])
      expect(bookmarkSchema.safeParse({ ...bookmark, url }).success).toBe(
        false,
      );
    expect(validResourceUrl("https://example.org/page#question7")).toBe(true);
    const s = room();
    s.study.bookmarks = [bookmark, bookmark];
    expect(() => validateImport(s)).toThrow();
  });
});
