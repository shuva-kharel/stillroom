import type { Mode, Segment, Session, Settings, Store, Timer } from "./types";
import { defaultStudy } from "./study";
import type { Practice } from "./study";
import { defaultPreferences } from "./preferences";
export const uid = () => crypto.randomUUID();
export const defaults: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  frequency: 4,
  autoStart: false,
  sound: true,
  notifications: false,
  alertVolume: 0.35,
  theme: "midnight",
  countdown: 1500,
  countStudy: true,
};
export function freshTimer(
  mode: Mode,
  settings: Settings,
  previous?: Timer,
): Timer {
  return {
    id: uid(),
    mode,
    duration:
      mode === "stopwatch"
        ? 0
        : mode === "countdown" || mode === "practice"
          ? settings.countdown * 1000
          : settings[mode] * 60000,
    elapsed: 0,
    runningSince: null,
    segments: [],
    subjectId: previous?.subjectId ?? "",
    intention: previous?.intention ?? "",
    cycle: previous?.cycle ?? 0,
    countStudy:
      mode === "countdown"
        ? settings.countStudy
        : mode === "focus" || mode === "stopwatch" || mode === "practice",
    taskId: previous?.taskId ?? "",
    ...(mode === "practice" && previous?.practice
      ? {
          practice: { ...previous.practice, done: 0, passed: 0 },
          duration: previous.practice.minutes * 60000,
        }
      : {}),
    laps: [],
  };
}
export function initialStore(): Store {
  return {
    version: 3,
    study: defaultStudy(),
    preferences: defaultPreferences(),
    settings: { ...defaults },
    subjects: [],
    tasks: [],
    notes: {},
    history: [],
    timer: freshTimer("focus", defaults),
    plan: [],
    exam: { name: "", date: "" },
    notice: "",
  };
}
export function elapsed(timer: Timer, now: number) {
  const value =
    timer.elapsed +
    (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));
  return timer.mode === "stopwatch" ? value : Math.min(timer.duration, value);
}
export function remaining(timer: Timer, now: number) {
  return timer.mode === "stopwatch"
    ? elapsed(timer, now)
    : Math.max(0, timer.duration - elapsed(timer, now));
}
export function expired(timer: Timer, now: number) {
  return (
    timer.mode !== "stopwatch" &&
    timer.runningSince !== null &&
    elapsed(timer, now) >= timer.duration
  );
}
function freeze(timer: Timer, now: number): Timer {
  if (timer.runningSince === null) return timer;
  const total = elapsed(timer, now);
  const end = timer.runningSince + Math.max(0, total - timer.elapsed);
  const segments =
    end > timer.runningSince
      ? [...timer.segments, { start: timer.runningSince, end }]
      : timer.segments;
  return { ...timer, elapsed: total, runningSince: null, segments };
}
export type TimerAction =
  | { type: "toggle" | "pause" | "reset" | "skip" | "tick" | "apply-duration" }
  | { type: "practice"; config: Practice }
  | { type: "finish-practice" }
  | { type: "lap"; label: string }
  | { type: "mode"; mode: Mode }
  | { type: "subject"; subjectId: string };
export function transition(
  store: Store,
  action: TimerAction,
  now: number,
  allowAuto = true,
): Store {
  let s = store;
  // Resolve an expired deadline exactly once before applying any new action.
  if (expired(s.timer, now)) {
    const deadline = s.timer.runningSince! + s.timer.duration - s.timer.elapsed;
    s = finish(
      s,
      deadline,
      true,
      undefined,
      allowAuto && now - deadline < 2000,
    );
    s = {
      ...s,
      notice: `${store.timer.mode === "practice" ? "Practice complete. Your actual study time was recorded." : store.timer.mode === "countdown" ? "Countdown complete." : store.timer.mode === "focus" ? "Focus session complete. Your time is saved." : "Break complete. Ready when you are."}${now - deadline >= 2000 ? " The next session is paused." : ""}`,
    };
    if (action.type === "tick" || action.type === "toggle") return s;
  }
  const t = s.timer;
  switch (action.type) {
    case "practice": {
      const next = finish(s, now, false, "practice", false);
      return {
        ...next,
        timer: {
          ...freshTimer("practice", s.settings, t),
          practice: { ...action.config, passed: 0, done: 0 },
          duration: action.config.minutes * 60000,
          subjectId: action.config.subjectId,
          intention: action.config.name,
          taskId: "",
          countStudy: true,
          runningSince: now,
        },
      };
    }
    case "finish-practice":
      return t.mode === "practice" ? finish(s, now, false, "focus", false) : s;
    case "tick":
      return s;
    case "lap":
      if (
        t.mode !== "stopwatch" ||
        t.runningSince === null ||
        t.laps.length >= 200
      )
        return s;
      return {
        ...s,
        timer: {
          ...t,
          laps: [
            ...t.laps,
            {
              id: uid(),
              elapsed: elapsed(t, now),
              label: action.label.trim().slice(0, 100),
            },
          ],
        },
      };
    case "pause":
      return t.runningSince === null ? s : { ...s, timer: freeze(t, now) };
    case "toggle":
      return {
        ...s,
        study:
          t.runningSince === null && t.countStudy && t.mode !== "practice"
            ? {
                ...s.study,
                last: {
                  subjectId: t.subjectId,
                  taskId: t.taskId ?? "",
                  intention: t.intention,
                  mode: t.mode as "focus" | "countdown" | "stopwatch",
                  duration: t.duration,
                  roomId: s.study.selectedRoom,
                },
              }
            : s.study,
        timer:
          t.runningSince === null
            ? { ...t, runningSince: now }
            : freeze(t, now),
      };
    case "apply-duration":
    case "reset":
      return {
        ...finish(s, now, false, t.mode, false),
        notice:
          elapsed(t, now) > 0 && t.countStudy
            ? "Timer reset. Your partial focus time was saved."
            : "Timer reset.",
      };
    case "skip":
      return {
        ...finish(s, now, false, undefined, false),
        notice: "Session skipped. Any focused time was saved as partial.",
      };
    case "mode":
      return action.mode === t.mode
        ? s
        : {
            ...finish(s, now, false, action.mode, false),
            notice:
              elapsed(t, now) > 0
                ? "Mode changed. Any focused time was saved."
                : "",
          };
    case "subject":
      return action.subjectId === t.subjectId
        ? s
        : {
            ...finish(s, now, false, t.mode, false),
            timer: {
              ...freshTimer(t.mode, s.settings, t),
              subjectId: action.subjectId,
              taskId: "",
            },
            notice:
              elapsed(t, now) > 0
                ? "Subject changed. Your previous focus time was saved."
                : "",
          };
  }
}
function finish(
  store: Store,
  now: number,
  completed: boolean,
  nextMode?: Mode,
  allowAuto = false,
): Store {
  const t = freeze(store.timer, now);
  let history = store.history;
  const focus = t.countStudy;
  if (focus && t.elapsed > 0 && !history.some((s) => s.id === t.id)) {
    const session: Session = {
      id: t.id,
      subjectId: t.subjectId,
      subjectName:
        store.subjects.find((s) => s.id === t.subjectId)?.name ??
        "Independent study",
      intention: t.intention,
      mode: t.mode as Session["mode"],
      duration: t.elapsed,
      endedAt: now,
      completed:
        completed &&
        (t.mode === "focus" || t.mode === "countdown" || t.mode === "practice"),
      segments: t.segments,
      taskId: t.taskId,
      ...(t.practice ? { practice: t.practice } : {}),
    };
    history = [...history, session];
  }
  const cycle = t.cycle + (completed && t.mode === "focus" ? 1 : 0);
  const mode =
    nextMode ??
    (t.mode === "practice"
      ? "focus"
      : t.mode === "countdown"
        ? "countdown"
        : t.mode === "focus" || t.mode === "stopwatch"
          ? cycle > 0 && cycle % store.settings.frequency === 0
            ? "long"
            : "short"
          : "focus");
  const timer = freshTimer(mode, store.settings, { ...t, cycle });
  if (
    completed &&
    t.mode !== "countdown" &&
    t.mode !== "practice" &&
    (store.settings.autoStart ||
      (mode === "focus"
        ? store.preferences.cycles.autoFocus
        : store.preferences.cycles.autoBreak)) &&
    allowAuto
  )
    timer.runningSince = now;
  return { ...store, history, timer };
}
export function formatClock(ms: number, countUp = false) {
  const seconds = countUp ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : minutes > 0
      ? `${minutes}m`
      : ms > 0
        ? "<1m"
        : "0m";
}
export function localDay(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function timeOnDay(segments: Segment[], date: Date) {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
  return segments.reduce(
    (sum, s) =>
      sum + Math.max(0, Math.min(s.end, end) - Math.max(s.start, start)),
    0,
  );
}
export function activeSegments(timer: Timer, now: number) {
  return freeze(timer, now).segments;
}
