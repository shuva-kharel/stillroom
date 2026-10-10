import { useState } from "react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { addDays, studyWithin, weekBounds } from "../study";
import { formatDuration, localDay } from "../timer";
import { Select } from "./Select";
export default function WeeklyReview({
  store,
  setStore,
}: {
  store: Store;
  setStore: SetStore;
}) {
  const [date, setDate] = useState(localDay(Date.now()));
  const week = weekBounds(
      new Date(date + "T12:00:00").getTime(),
      store.study.weekStart,
    ),
    previous = weekBounds(
      new Date(addDays(week.key, -7) + "T12:00:00").getTime(),
      store.study.weekStart,
    );
  const total = studyWithin(store, week.start, week.end),
    prior = studyWithin(store, previous.start, previous.end),
    notes = store.study.weeks[week.key] ?? { reflection: "", priorities: "" };
  const completed = store.study.completions.filter(
      (c) => c.at >= week.start && c.at < week.end,
    ),
    plan = store.study.plans[week.key],
    sessions = store.history.filter(
      (h) => h.endedAt >= week.start && h.endedAt < week.end,
    );
  const subjects = new Map<string, { name: string; time: number }>();
  store.history.forEach((h) => {
    const time = h.segments.reduce(
      (n, p) =>
        n +
        Math.max(0, Math.min(week.end, p.end) - Math.max(week.start, p.start)),
      0,
    );
    if (time)
      subjects.set(h.subjectId, {
        name: h.subjectName,
        time: (subjects.get(h.subjectId)?.time ?? 0) + time,
      });
  });
  const edit = (field: "reflection" | "priorities", value: string) =>
    setStore((s) => ({
      ...s,
      study: {
        ...s.study,
        weeks: { ...s.study.weeks, [week.key]: { ...notes, [field]: value } },
      },
    }));
  return (
    <div className="form-stack">
      <div className="form-grid">
        <label>
          A day in the selected week
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <Select
          label="Week starts on"
          value={String(store.study.weekStart)}
          onChange={(v) =>
            setStore((s) => ({
              ...s,
              study: { ...s.study, weekStart: Number(v) as 0 | 1 },
            }))
          }
          options={[
            { value: "1", label: "Monday" },
            { value: "0", label: "Sunday" },
          ]}
        />
      </div>
      <div className="tool-card">
        <span className="eyebrow">WEEK OF {week.key}</span>
        <h2>{formatDuration(total)} studied</h2>
        <p className="field-hint">
          Previous week: {formatDuration(prior)} · {total >= prior ? "+" : "−"}
          {formatDuration(Math.abs(total - prior))}. Time spent is a record of
          effort, not a measure of learning.
        </p>
        {[...subjects].map(([id, s]) => (
          <div className="weekly-line" key={id}>
            <span>{s.name}</span>
            <strong>{formatDuration(s.time)}</strong>
          </div>
        ))}
      </div>
      <h3>Completed tasks</h3>
      {completed.length ? (
        completed.map((c) => (
          <p key={c.id}>
            {c.title} <small>· {new Date(c.at).toLocaleDateString()}</small>
          </p>
        ))
      ) : (
        <p className="field-hint">
          No timestamped task completions for this week. Older tasks without
          completion dates are not reconstructed.
        </p>
      )}
      <h3>Plan & actual work</h3>
      {plan ? (
        <>
          <p className="field-hint">
            Plan captured {new Date(plan.createdAt).toLocaleString()}.{" "}
            {
              plan.tasks.filter((t) => completed.some((c) => c.taskId === t.id))
                .length
            }{" "}
            of {plan.tasks.length} planned tasks completed this week.
          </p>
          {plan.tasks.map((t) => (
            <p key={t.id}>
              {t.title} · {t.estimate} estimated Pomodoros
            </p>
          ))}
        </>
      ) : (
        <p className="field-hint">
          No historical plan was captured for this week.
        </p>
      )}
      {!plan &&
        week.key === weekBounds(Date.now(), store.study.weekStart).key && (
          <button
            className="secondary-button"
            onClick={() =>
              setStore((s) => ({
                ...s,
                study: {
                  ...s.study,
                  plans: {
                    ...s.study.plans,
                    [week.key]: {
                      createdAt: Date.now(),
                      tasks: s.tasks
                        .filter((t) => !t.done)
                        .map(({ id, title, estimate }) => ({
                          id,
                          title,
                          estimate,
                        })),
                    },
                  },
                },
              }))
            }
          >
            Capture this week’s current task plan
          </button>
        )}
      <h3>Focus reflections</h3>
      <div className="button-row">
        {["focused", "mixed", "distracted", "unrated"].map((r) => (
          <span className="quiet-chip" key={r}>
            {r}:{" "}
            {
              sessions.filter(
                (h) =>
                  (store.study.reflections[h.id]?.rating || "unrated") === r,
              ).length
            }
          </span>
        ))}
      </div>
      <label>
        Weekly reflection
        <textarea
          maxLength={2000}
          value={notes.reflection}
          onChange={(e) => edit("reflection", e.target.value)}
        />
      </label>
      <label>
        Next-week priorities
        <textarea
          maxLength={2000}
          value={notes.priorities}
          onChange={(e) => edit("priorities", e.target.value)}
        />
      </label>
    </div>
  );
}
