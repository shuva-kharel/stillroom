import { BookOpen, Clock3, Trash2 } from "lucide-react";
import type { Store } from "../types";
import { formatDuration, localDay, timeOnDay } from "../timer";
import type { SetStore } from "./Companion";
import { EmptyState, IconButton, Modal } from "./UI";

export function History({
  store,
  setStore,
  onClose,
}: {
  store: Store;
  setStore: SetStore;
  onClose: () => void;
}) {
  const today = new Date();
  const days = Array.from(
    { length: 7 },
    (_, i) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i),
  );
  const values = days.map((day) =>
    store.history.reduce((sum, s) => sum + timeOnDay(s.segments, day), 0),
  );
  const max = Math.max(...values, 60000);
  const totals = new Map<
    string,
    { name: string; time: number; color: string }
  >();
  store.history.forEach((s) => {
    const subject = store.subjects.find((x) => x.id === s.subjectId);
    const previous = totals.get(s.subjectId);
    totals.set(s.subjectId, {
      name: subject?.name ?? s.subjectName,
      time: (previous?.time ?? 0) + s.duration,
      color: subject?.color ?? "var(--accent)",
    });
  });
  return (
    <Modal
      title="Time, well spent."
      subtitle="An honest record of your study. Every small session counts."
      onClose={onClose}
      wide
    >
      <div className="history-summary">
        <div>
          <span className="eyebrow">FOCUSED TODAY</span>
          <strong>{formatDuration(values[6])}</strong>
        </div>
        <div>
          <span className="eyebrow">COMPLETED TODAY</span>
          <strong>
            {
              store.history.filter(
                (s) =>
                  s.completed && localDay(s.endedAt) === localDay(Date.now()),
              ).length
            }
            <small> sessions</small>
          </strong>
        </div>
        <div>
          <span className="eyebrow">ALL-TIME FOCUS</span>
          <strong>
            {formatDuration(
              store.history.reduce((sum, s) => sum + s.duration, 0),
            )}
          </strong>
        </div>
      </div>
      <div className="section-heading">
        <h3>The last seven days</h3>
        <span className="tiny-label">Your local time</span>
      </div>
      <div
        className="activity-chart"
        role="img"
        aria-label={days
          .map(
            (d, i) => `${d.toLocaleDateString()}: ${formatDuration(values[i])}`,
          )
          .join(", ")}
      >
        {days.map((d, i) => (
          <div className="chart-column" key={localDay(d.getTime())}>
            <span>{formatDuration(values[i])}</span>
            <div className="chart-track">
              <div style={{ height: `${(values[i] / max) * 100}%` }} />
            </div>
            <span className={i === 6 ? "today-label" : ""}>
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>
      {totals.size > 0 && (
        <>
          <h3 className="subheading">
            By subject <span>all time</span>
          </h3>
          <div className="subject-breakdown">
            {[...totals.entries()].map(([id, value]) => (
              <div key={id}>
                <span
                  className="subject-dot"
                  style={{ background: value.color }}
                />
                <span>{value.name}</span>
                <strong>{formatDuration(value.time)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      <h3 className="subheading">
        Session journal <span>{store.history.length} entries</span>
      </h3>
      {store.history.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title="The first page is yours."
        >
          Finish a session or save partial work to begin your journal.
        </EmptyState>
      ) : (
        <div className="history-list">
          {[...store.history].reverse().map((session) => (
            <div className="history-row" key={session.id}>
              <Clock3 size={17} />
              <div>
                <strong>{session.subjectName}</strong>
                <p>{session.intention || "An open study session"}</p>
                <span>
                  {session.mode === "practice"
                    ? "Exam practice"
                    : session.mode === "countdown"
                      ? "Countdown"
                      : session.mode === "stopwatch"
                        ? "Stopwatch"
                        : "Pomodoro"}{" "}
                  ·{" "}
                  {new Date(session.endedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="session-duration">
                <strong>{formatDuration(session.duration)}</strong>
                <span className={session.completed ? "complete-label" : ""}>
                  {session.completed ? "Completed" : "Partial"}
                </span>
              </div>
              <IconButton
                label={`Remove session from ${new Date(session.endedAt).toLocaleString()}`}
                onClick={() => {
                  if (
                    confirm(
                      "Remove this session from your study history? This cannot be undone.",
                    )
                  )
                    setStore((s) => ({
                      ...s,
                      history: s.history.filter((x) => x.id !== session.id),
                      study: {
                        ...s.study,
                        reflections: Object.fromEntries(
                          Object.entries(s.study.reflections).filter(
                            ([id]) => id !== session.id,
                          ),
                        ),
                      },
                    }));
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <p className="field-hint">
        Live sessions appear here when finished, reset, or skipped. Paused time
        and breaks never count toward focus time.
      </p>
    </Modal>
  );
}
