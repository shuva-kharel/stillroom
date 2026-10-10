import { defaultStudy, studySchema, practiceSchema } from "./study";
import type { Store } from "./types";
import { defaults, initialStore, transition } from "./timer";
import { defaultPreferences, parsePreferences } from "./preferences";
export const STORAGE_KEY = "stillroom.v3";
export const LEGACY_KEY = "stillroom.v1";
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 1000000): v is string =>
  typeof v === "string" && v.length <= max;
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const bool = (v: unknown) => typeof v === "boolean";
const segments = (v: unknown) =>
  Array.isArray(v) &&
  v.every((s) => record(s) && num(s.start) && num(s.end) && s.end >= s.start);
const array = (v: unknown, check: (x: Record<string, unknown>) => boolean) =>
  Array.isArray(v) &&
  v.length <= 100000 &&
  v.every((x) => record(x) && check(x)) &&
  new Set(v.map((x) => x.id)).size === v.length;
export function validateImport(value: unknown): Store {
  if (!record(value) || ![1, 2, 3].includes(Number(value.version)))
    throw new Error(
      "This is not a supported Stillroom export (versions 1, 2 or 3).",
    );
  const { settings: s, timer: t } = value;
  if (
    !record(s) ||
    !["midnight", "paper", "rain"].includes(String(s.theme)) ||
    !["focus", "short", "long"].every((k) => num(s[k], 1, 180)) ||
    !num(s.frequency, 1, 12) ||
    !Number.isInteger(s.frequency) ||
    !bool(s.autoStart) ||
    !bool(s.sound) ||
    !bool(s.notifications) ||
    !num(s.alertVolume, 0, 1)
  )
    throw new Error("The export contains invalid timer settings.");
  if (
    !array(
      value.subjects,
      (x) =>
        str(x.id, 100) &&
        str(x.name, 100) &&
        /^#[0-9a-f]{6}$/i.test(String(x.color)),
    ) ||
    !array(
      value.tasks,
      (x) =>
        str(x.id, 100) &&
        str(x.title, 500) &&
        str(x.subjectId, 100) &&
        num(x.estimate, 0, 20) &&
        Number.isInteger(x.estimate) &&
        bool(x.done),
    ) ||
    !array(
      value.plan,
      (x) => str(x.id, 100) && str(x.title, 500) && bool(x.done),
    )
  )
    throw new Error("The export contains invalid subjects or tasks.");
  if (!record(value.notes) || !Object.values(value.notes).every((x) => str(x)))
    throw new Error("The export contains invalid notes.");
  if (
    !array(
      value.history,
      (x) =>
        str(x.id, 100) &&
        str(x.subjectId, 100) &&
        str(x.subjectName, 100) &&
        str(x.intention, 500) &&
        ["focus", "stopwatch", "countdown", "practice"].includes(
          String(x.mode),
        ) &&
        num(x.duration) &&
        num(x.endedAt) &&
        bool(x.completed) &&
        segments(x.segments) &&
        Math.abs(
          (x.segments as { start: number; end: number }[]).reduce(
            (n, z) => n + z.end - z.start,
            0,
          ) - Number(x.duration),
        ) < 1,
    )
  )
    throw new Error("The export contains invalid history.");
  if (
    !record(t) ||
    !str(t.id, 100) ||
    !["focus", "short", "long", "stopwatch", "countdown", "practice"].includes(
      String(t.mode),
    ) ||
    !num(t.duration, 0, 86400000) ||
    (t.mode !== "stopwatch" &&
      t.duration < (t.mode === "countdown" ? 1000 : 60000)) ||
    !num(t.elapsed) ||
    (t.mode !== "stopwatch" && t.elapsed > t.duration) ||
    !(t.runningSince === null || num(t.runningSince)) ||
    !segments(t.segments) ||
    !str(t.subjectId, 100) ||
    !str(t.intention, 500) ||
    !num(t.cycle) ||
    !Number.isInteger(t.cycle) ||
    Math.abs(
      (t.segments as { start: number; end: number }[]).reduce(
        (n, z) => n + z.end - z.start,
        0,
      ) - Number(t.elapsed),
    ) >= 1
  )
    throw new Error("The export contains invalid timer state.");
  if (
    !record(value.exam) ||
    !str(value.exam.name, 100) ||
    !str(value.exam.date, 10) ||
    (value.exam.date !== "" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value.exam.date) ||
        Number.isNaN(Date.parse(value.exam.date))))
  )
    throw new Error("The export contains an invalid exam date.");
  if (
    Number(value.version) >= 2 &&
    (!num(s.countdown, 1, 86400) ||
      !bool(s.countStudy) ||
      !bool(t.countStudy) ||
      !Array.isArray(t.laps) ||
      t.laps.length > 200 ||
      !t.laps.every(
        (l) =>
          record(l) && str(l.id, 100) && num(l.elapsed) && str(l.label, 100),
      ))
  )
    throw new Error("The export contains invalid countdown or lap settings.");
  const preferences =
    Number(value.version) >= 2
      ? parsePreferences(value.preferences)
      : defaultPreferences();
  if (value.version === 1) {
    preferences.layout.companionOpen = true;
    preferences.cycles.autoBreak = s.autoStart as boolean;
    preferences.cycles.autoFocus = s.autoStart as boolean;
    preferences.alarms.volume = s.alertVolume as number;
    preferences.view = t.mode === "stopwatch" ? "stopwatch" : "pomodoro";
    if (s.theme === "paper") {
      preferences.background.color = "#f3f0e7";
      preferences.background.preset = "paper-desk";
    }
    if (s.theme === "rain") {
      preferences.background.color = "#202931";
      preferences.background.preset = "rain-window";
    }
  }
  if (t.practice !== undefined) practiceSchema.parse(t.practice);
  if (t.mode === "practice" && !t.practice)
    throw new Error("Practice configuration is missing.");
  for (const h of value.history as Record<string, unknown>[])
    if (h.practice !== undefined) practiceSchema.parse(h.practice);
  for (const task of value.tasks as Record<string, unknown>[])
    if (task.completedAt !== undefined && !num(task.completedAt))
      throw new Error("Invalid task completion date.");
  if (t.taskId !== undefined && !str(t.taskId, 100))
    throw new Error("Invalid current task.");
  const original = value as unknown as Store;
  return {
    version: 3,
    study:
      value.version === 3 ? studySchema.parse(value.study) : defaultStudy(),
    settings: { ...defaults, ...original.settings },
    preferences,
    subjects: original.subjects,
    tasks: original.tasks,
    notes: original.notes,
    history: original.history,
    timer: {
      ...original.timer,
      countStudy:
        original.timer.countStudy ??
        (t.mode === "focus" || t.mode === "stopwatch"),
      laps: original.timer.laps ?? [],
    },
    plan: original.plan,
    exam: original.exam,
    notice: "",
  };
}
export function load(): {
  store: Store;
  warning: string;
  writeBlocked?: boolean;
} {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("stillroom.v2") ??
      localStorage.getItem(LEGACY_KEY);
    return {
      store: raw ? validateImport(JSON.parse(raw)) : initialStore(),
      warning: "",
    };
  } catch {
    let writeBlocked = false;
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        localStorage.getItem("stillroom.v2") ??
        localStorage.getItem(LEGACY_KEY);
      if (raw) localStorage.setItem("stillroom.recovery", raw);
    } catch {
      writeBlocked = true;
    }
    return {
      store: initialStore(),
      writeBlocked,
      warning:
        "Saved data could not be read. A fresh room is open; the original data is kept under stillroom.recovery if storage is available.",
    };
  }
}
export function save(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
export function exportSnapshot(store: Store, now = Date.now()) {
  return store.timer.runningSince === null
    ? store
    : transition(store, { type: "toggle" }, now, false);
}
export function downloadExport(store: Store) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          ...exportSnapshot(store),
          backup: {
            mediaIncluded: false,
            note: "Uploaded backgrounds and custom alarms are device-local IndexedDB assets. JSON backups omit media; missing assets use a safe fallback.",
          },
        },
        null,
        2,
      ),
    ],
    {
      type: "application/json",
    },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stillroom-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
