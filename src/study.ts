import { z } from "zod";
import type { Store } from "./types";
import { elapsed, freshTimer, localDay } from "./timer";
import { applyRoom, builtinRooms } from "./roomPresets";
import { bookmarkSchema, bookmarkText, currentBookmark } from "./bookmarks";
const text = z.string().max(2000),
  id = z.string().max(100),
  timestamp = z.number().finite().nonnegative();
export function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}
const date = z.string().refine(calendarDate, "Use a valid calendar date");
export const practiceSchema = z.object({
  name: z.string().min(1).max(100),
  subjectId: id,
  minutes: z.number().min(1).max(1440),
  questions: z.number().int().min(1).max(1000),
  done: z.number().int().min(0).max(1000),
  sections: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        minutes: z.number().min(1).max(1440),
      }),
    )
    .max(20),
  checkpoint: z.number().int().min(0).max(240),
  sound: z.boolean(),
  passed: z.number().int().nonnegative(),
});
export type Practice = z.infer<typeof practiceSchema>;
export const reflectionSchema = z.object({
  finished: text,
  next: text,
  rating: z.enum(["", "focused", "mixed", "distracted"]),
  score: z.string().max(100),
});
export type Reflection = z.infer<typeof reflectionSchema>;
export const reviewSchema = z.object({
  id,
  title: z.string().min(1).max(500),
  subjectId: id,
  taskId: id,
  source: z.enum(["topic", "subject", "task", "note"]),
  due: date,
  completedAt: timestamp.nullable(),
});
export type ReviewItem = z.infer<typeof reviewSchema>;
export const studySchema = z.object({
  bookmarks: z
    .array(bookmarkSchema)
    .max(100000)
    .refine(
      (items) => new Set(items.map((b) => b.id)).size === items.length,
      "Bookmark IDs must be unique",
    )
    .default([]),
  currentBookmarks: z.record(id, id).default({}),
  last: z
    .object({
      subjectId: id,
      taskId: id,
      intention: z.string().max(500),
      mode: z.enum(["focus", "countdown", "stopwatch"]),
      duration: timestamp,
      roomId: id,
    })
    .nullable()
    .default(null),
  selectedRoom: id.default(""),
  reviews: z.array(reviewSchema).max(100000).default([]),
  reflections: z.record(id, reflectionSchema).default({}),
  parking: z
    .array(
      z.object({
        id,
        text: z.string().min(1).max(2000),
        createdAt: timestamp,
        resolved: z.boolean(),
      }),
    )
    .max(100000)
    .default([]),
  completions: z
    .array(
      z.object({
        id,
        taskId: id,
        title: z.string().max(500),
        subjectId: id,
        at: timestamp,
      }),
    )
    .max(100000)
    .default([]),
  plans: z
    .record(
      date,
      z.object({
        createdAt: timestamp,
        tasks: z
          .array(
            z.object({
              id,
              title: z.string().max(500),
              estimate: z.number().min(0).max(20),
            }),
          )
          .max(100000),
      }),
    )
    .default({}),
  weeks: z
    .record(date, z.object({ reflection: text, priorities: text }))
    .default({}),
  weekStart: z.union([z.literal(0), z.literal(1)]).default(1),
  breakScreen: z
    .object({
      enabled: z.boolean(),
      water: z.boolean(),
      stretch: z.boolean(),
      breathing: z.boolean(),
    })
    .default({ enabled: false, water: true, stretch: true, breathing: false }),
});
export type StudyData = z.infer<typeof studySchema>;
export const defaultStudy = (): StudyData => studySchema.parse({});
export function addDays(value: string, days: number) {
  const [y, m, d] = value.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + days, 12).getTime());
}
export function weekBounds(now: number, start: 0 | 1) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - start + 7) % 7));
  const end = new Date(d);
  end.setDate(end.getDate() + 7);
  return { start: d.getTime(), end: end.getTime(), key: localDay(d.getTime()) };
}
export function resumePreview(s: Store) {
  if (s.timer.runningSince !== null || elapsed(s.timer, Date.now()) > 0) {
    const place = currentBookmark(s, s.timer.subjectId, s.timer.taskId);
    return `Return to your current session — its time stays intact.${place ? ` Resume point: ${bookmarkText(place)}` : ""}`;
  }
  const last = s.study.last;
  if (!last) {
    const place = currentBookmark(s, s.timer.subjectId, s.timer.taskId);
    return `Your room is ready. Intention is optional.${place ? ` Resume point: ${bookmarkText(place)}` : ""}`;
  }
  const task = s.tasks.find((t) => t.id === last.taskId && !t.done);
  const preferredSubject = task?.subjectId ?? last.subjectId;
  const subjectId = s.subjects.some((x) => x.id === preferredSubject)
    ? preferredSubject
    : "";
  const room = [...builtinRooms, ...s.preferences.rooms].find(
    (r) => r.id === last.roomId,
  );
  const place = currentBookmark(s, subjectId, task?.id);
  return [
    s.subjects.find((x) => x.id === subjectId)?.name ?? "Independent study",
    task?.title,
    last.mode === "stopwatch"
      ? "Stopwatch · open ended"
      : `${last.mode === "focus" ? "Pomodoro" : "Timer"} · ${Number((last.duration / 60000).toFixed(2))} minutes`,
    room?.name,
    place ? `Resume point: ${bookmarkText(place)}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function resumeStudy(s: Store): Store {
  if (s.timer.runningSince !== null || elapsed(s.timer, Date.now()) > 0)
    return {
      ...s,
      preferences: {
        ...s.preferences,
        view:
          s.timer.mode === "stopwatch"
            ? "stopwatch"
            : s.timer.mode === "countdown" || s.timer.mode === "practice"
              ? "timer"
              : "pomodoro",
      },
    };
  const last = s.study.last;
  if (!last) return s;
  const room = [...builtinRooms, ...s.preferences.rooms].find(
    (r) => r.id === last.roomId,
  );
  const next = room ? applyRoom(s, room) : s;
  const task = s.tasks.find((t) => t.id === last.taskId && !t.done);
  const preferredSubject = task?.subjectId ?? last.subjectId;
  const subjectId = s.subjects.some((x) => x.id === preferredSubject)
    ? preferredSubject
    : "";
  return {
    ...next,
    preferences: {
      ...next.preferences,
      view:
        last.mode === "stopwatch"
          ? "stopwatch"
          : last.mode === "countdown"
            ? "timer"
            : "pomodoro",
    },
    timer: {
      ...freshTimer(last.mode, s.settings, s.timer),
      subjectId,
      intention: task?.title || (last.taskId ? "" : last.intention),
      taskId: task?.id ?? "",
      duration:
        last.mode === "stopwatch"
          ? 0
          : Math.min(
              86400000,
              Math.max(last.mode === "focus" ? 60000 : 1000, last.duration),
            ),
    },
  };
}
export function attachReflection(
  s: Store,
  sessionId: string,
  reflection: Reflection,
): Store {
  if (!s.history.some((x) => x.id === sessionId)) return s;
  return {
    ...s,
    study: {
      ...s.study,
      reflections: {
        ...s.study.reflections,
        [sessionId]: reflectionSchema.parse(reflection),
      },
    },
  };
}
export function completeTask(s: Store, taskId: string, now: number): Store {
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task || task.done) return s;
  return {
    ...s,
    tasks: s.tasks.map((t) =>
      t.id === taskId ? { ...t, done: true, completedAt: now } : t,
    ),
    study: {
      ...s.study,
      completions: [
        ...s.study.completions,
        {
          id: crypto.randomUUID(),
          taskId,
          title: task.title,
          subjectId: task.subjectId,
          at: now,
        },
      ],
    },
  };
}
export function studyWithin(s: Store, start: number, end: number) {
  return s.history.reduce(
    (sum, h) =>
      sum +
      h.segments.reduce(
        (n, p) =>
          n + Math.max(0, Math.min(end, p.end) - Math.max(start, p.start)),
        0,
      ),
    0,
  );
}
