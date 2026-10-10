import { useState } from "react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { elapsed, formatClock, remaining, type TimerAction } from "../timer";
import { practiceSchema, type Practice } from "../study";
import { Select } from "./Select";
import { Toggle } from "./Controls";
export default function PracticePanel({
  store,
  setStore,
  now,
  act,
  onFinish,
}: {
  store: Store;
  setStore: SetStore;
  now: number;
  act: (a: TimerAction) => void;
  onFinish: () => void;
}) {
  const [draft, setDraft] = useState<Practice>({
      name: "",
      subjectId: store.timer.subjectId,
      minutes: 60,
      questions: 30,
      sections: [],
      checkpoint: 15,
      sound: false,
      passed: 0,
      done: 0,
    }),
    [error, setError] = useState("");
  const active =
    store.timer.mode === "practice" ? store.timer.practice : undefined;
  if (active) {
    const used = elapsed(store.timer, now),
      expected = (used / store.timer.duration) * active.questions,
      diff = active.done - expected;
    let cursor = 0;
    const section = active.sections.find((s) => {
      cursor += s.minutes * 60000;
      return used < cursor;
    });
    return (
      <div className="form-stack">
        <div className="practice-display">
          <span className="eyebrow">{active.name}</span>
          <h2>{formatClock(remaining(store.timer, now))}</h2>
          <p>
            {Math.abs(diff) <= 1 ? "On pace" : diff > 0 ? "Ahead" : "Behind"} ·
            target {Math.round(store.timer.duration / active.questions / 1000)}{" "}
            seconds per question
          </p>
          {section && (
            <p>
              Current section: {section.name} · {formatClock(cursor - used)}{" "}
              remaining
            </p>
          )}
        </div>
        <label>
          Questions completed
          <input
            type="number"
            min={0}
            max={active.questions}
            step={1}
            value={active.done}
            onChange={(e) => {
              const done = Number(e.target.value);
              if (
                Number.isInteger(done) &&
                done >= 0 &&
                done <= active.questions
              )
                setStore((s) => ({
                  ...s,
                  timer: {
                    ...s.timer,
                    practice: { ...s.timer.practice!, done },
                  },
                }));
            }}
          />
        </label>
        <p className="field-hint">
          {active.done} / {active.questions} questions. Pace describes time
          allocation, not accuracy.
        </p>
        <div className="button-row">
          <button
            className="primary-button"
            onClick={() => act({ type: "toggle" })}
          >
            {store.timer.runningSince === null
              ? "Resume practice"
              : "Pause practice"}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              act({ type: "finish-practice" });
              onFinish();
            }}
          >
            Finish early & reflect
          </button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const result = practiceSchema.safeParse(draft);
        if (!result.success) {
          setError("Check the duration, question count, and section names.");
          return;
        }
        if (
          draft.sections.length &&
          Math.abs(
            draft.sections.reduce((n, s) => n + s.minutes, 0) - draft.minutes,
          ) > 0.001
        ) {
          setError("Section budgets must add up to the total duration.");
          return;
        }
        if (
          (store.timer.runningSince !== null ||
            elapsed(store.timer, now) > 0) &&
          !confirm(
            "Starting practice ends your current session and records its actual time as partial. Continue?",
          )
        )
          return;
        act({ type: "practice", config: draft });
        setStore((s) => ({
          ...s,
          preferences: { ...s.preferences, view: "timer" },
        }));
        setError("");
      }}
    >
      <p className="field-hint">
        One timed paper, with optional section budgets. Practice time counts
        toward study time, separately from Pomodoro completions.
      </p>
      <label>
        Exam name
        <input
          required
          maxLength={100}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <Select
        label="Practice subject"
        value={draft.subjectId}
        onChange={(v) => setDraft({ ...draft, subjectId: v })}
        options={[
          { value: "", label: "Independent study" },
          ...store.subjects.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <div className="form-grid">
        <label>
          Total minutes
          <input
            required
            type="number"
            min={1}
            max={1440}
            value={draft.minutes}
            onChange={(e) =>
              setDraft({ ...draft, minutes: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Question count
          <input
            required
            type="number"
            min={1}
            max={1000}
            step={1}
            value={draft.questions}
            onChange={(e) =>
              setDraft({ ...draft, questions: Number(e.target.value) })
            }
          />
        </label>
      </div>
      {draft.sections.map((s, i) => (
        <div className="form-grid" key={i}>
          <label>
            Section {i + 1}
            <input
              required
              maxLength={100}
              value={s.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sections: draft.sections.map((x, j) =>
                    i === j ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <label>
            Minutes
            <input
              required
              type="number"
              min={1}
              max={1440}
              value={s.minutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sections: draft.sections.map((x, j) =>
                    i === j ? { ...x, minutes: Number(e.target.value) } : x,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setDraft({
                ...draft,
                sections: draft.sections.filter((_, j) => i !== j),
              })
            }
          >
            Remove section
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary-button"
        disabled={draft.sections.length >= 20}
        onClick={() =>
          setDraft({
            ...draft,
            sections: [...draft.sections, { name: "", minutes: 10 }],
          })
        }
      >
        Add section budget
      </button>
      <label>
        Checkpoint interval in minutes (0 disables)
        <input
          type="number"
          min={0}
          max={240}
          step={1}
          value={draft.checkpoint}
          onChange={(e) =>
            setDraft({ ...draft, checkpoint: Number(e.target.value) })
          }
        />
      </label>
      <Toggle
        label="Checkpoint sounds"
        checked={draft.sound}
        onChange={(sound) => setDraft({ ...draft, sound })}
      />
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <button className="primary-button">Start practice</button>
    </form>
  );
}
