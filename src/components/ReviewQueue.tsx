import { useState } from "react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { addDays, calendarDate, type ReviewItem } from "../study";
import { freshTimer, localDay, transition, uid } from "../timer";
import { Select } from "./Select";
export default function ReviewQueue({
  store,
  setStore,
  onStudy,
}: {
  store: Store;
  setStore: SetStore;
  onStudy: () => void;
}) {
  const today = localDay(Date.now());
  const blank = (): ReviewItem => ({
    id: uid(),
    title: "",
    subjectId: store.timer.subjectId,
    taskId: "",
    source: "topic",
    due: addDays(today, 1),
    completedAt: null,
  });
  const [draft, setDraft] = useState<ReviewItem | null>(null),
    [filter, setFilter] = useState("due"),
    [repeat, setRepeat] = useState("none");
  const patch = (item: ReviewItem) =>
    setStore((s) => ({
      ...s,
      study: {
        ...s.study,
        reviews: s.study.reviews.some((r) => r.id === item.id)
          ? s.study.reviews.map((r) => (r.id === item.id ? item : r))
          : [...s.study.reviews, item],
      },
    }));
  const items = store.study.reviews
    .filter((r) =>
      filter === "all" || filter === "done"
        ? filter === "all" || r.completedAt !== null
        : r.completedAt === null &&
          (filter === "overdue" ? r.due < today : r.due <= today),
    )
    .sort((a, b) => a.due.localeCompare(b.due));
  return (
    <div className="form-stack">
      <p className="field-hint">
        User-controlled review scheduling. Choose when you want to return to
        something.
      </p>
      <div className="button-row">
        <Select
          label="Review view"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "due", label: "Due today & overdue" },
            { value: "overdue", label: "Overdue" },
            { value: "all", label: "All reviews" },
            { value: "done", label: "Completed" },
          ]}
        />
        <button className="primary-button" onClick={() => setDraft(blank())}>
          New review
        </button>
      </div>
      {draft && (
        <form
          className="tool-card form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.title.trim() && calendarDate(draft.due)) {
              patch({ ...draft, title: draft.title.trim() });
              setDraft(null);
            }
          }}
        >
          <Select
            label="Create review from"
            value={draft.source}
            onChange={(v) =>
              setDraft({
                ...draft,
                source: v as ReviewItem["source"],
                taskId: "",
              })
            }
            options={["topic", "subject", "task", "note"].map((v) => ({
              value: v,
              label: v[0].toUpperCase() + v.slice(1),
            }))}
          />
          <Select
            label="Review subject"
            value={draft.subjectId}
            onChange={(v) =>
              setDraft({
                ...draft,
                subjectId: v,
                title:
                  draft.source === "subject"
                    ? (store.subjects.find((s) => s.id === v)?.name ?? "")
                    : draft.title,
              })
            }
            options={[
              { value: "", label: "Independent study" },
              ...store.subjects.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          {draft.source === "task" && (
            <Select
              label="Review task"
              value={draft.taskId}
              onChange={(v) => {
                const t = store.tasks.find((x) => x.id === v);
                if (t)
                  setDraft({
                    ...draft,
                    taskId: v,
                    title: t.title,
                    subjectId: t.subjectId,
                  });
              }}
              options={[
                { value: "", label: "Choose a task" },
                ...store.tasks.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          )}
          {draft.source === "note" && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setDraft({
                  ...draft,
                  title: (store.notes[draft.subjectId] ?? "").slice(0, 500),
                })
              }
            >
              Use text from this notebook
            </button>
          )}
          <label>
            Review topic
            <input
              required
              maxLength={500}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <div className="button-row">
            {[
              [1, "Tomorrow"],
              [3, "In three days"],
              [7, "In one week"],
            ].map(([n, label]) => (
              <button
                type="button"
                className="secondary-button"
                key={n}
                onClick={() =>
                  setDraft({ ...draft, due: addDays(today, Number(n)) })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Review date
            <input
              type="date"
              required
              value={draft.due}
              onChange={(e) => setDraft({ ...draft, due: e.target.value })}
            />
          </label>
          <div className="button-row">
            <button className="primary-button">Save review</button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <Select
        label="After completing a review"
        value={repeat}
        onChange={setRepeat}
        options={[
          { value: "none", label: "Do not schedule another review" },
          { value: "1", label: "Review again tomorrow" },
          { value: "3", label: "Review again in three days" },
          { value: "7", label: "Review again in one week" },
        ]}
      />
      {!items.length && (
        <p className="empty-state">
          No reviews here yet. Add a topic to return to.
        </p>
      )}
      {items.map((r) => (
        <article className="tool-card" key={r.id}>
          <div className="section-heading">
            <h3>{r.title}</h3>
            <span className="tiny-label">
              {r.completedAt
                ? "Completed"
                : r.due < today
                  ? "Overdue"
                  : r.due === today
                    ? "Today"
                    : r.due}
            </span>
          </div>
          <p className="field-hint">
            {store.subjects.find((s) => s.id === r.subjectId)?.name ??
              "Independent study"}{" "}
            · {r.due}
          </p>
          <div className="button-row">
            {!r.completedAt && (
              <>
                <button
                  className="primary-button"
                  onClick={() => {
                    if (
                      (store.timer.runningSince !== null ||
                        store.timer.elapsed > 0) &&
                      !confirm(
                        "End the current session and save its actual time before preparing this review?",
                      )
                    )
                      return;
                    setStore((s) => {
                      const next = transition(
                        s,
                        { type: "reset" },
                        Date.now(),
                        false,
                      );
                      return {
                        ...next,
                        preferences: { ...next.preferences, view: "pomodoro" },
                        timer: {
                          ...freshTimer("focus", s.settings, s.timer),
                          subjectId: s.subjects.some(
                            (x) => x.id === r.subjectId,
                          )
                            ? r.subjectId
                            : "",
                          intention: r.title,
                          taskId: r.taskId,
                        },
                      };
                    });
                    onStudy();
                  }}
                >
                  Study this
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setStore((s) => ({
                      ...s,
                      study: {
                        ...s.study,
                        reviews: [
                          ...s.study.reviews.map((x) =>
                            x.id === r.id
                              ? { ...x, completedAt: Date.now() }
                              : x,
                          ),
                          ...(repeat === "none"
                            ? []
                            : [
                                {
                                  ...r,
                                  id: uid(),
                                  due: addDays(today, Number(repeat)),
                                  completedAt: null,
                                },
                              ]),
                        ],
                      },
                    }))
                  }
                >
                  Complete review
                </button>
              </>
            )}
            <button
              className="text-button"
              onClick={() => setDraft({ ...r, completedAt: null })}
            >
              Edit / reschedule
            </button>
            <button
              className="text-button"
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  study: {
                    ...s.study,
                    reviews: s.study.reviews.filter((x) => x.id !== r.id),
                  },
                }))
              }
            >
              Delete review
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
