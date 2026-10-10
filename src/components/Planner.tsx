import { useState } from "react";
import { CalendarDays, Check, Plus, Trash2 } from "lucide-react";
import type { Store } from "../types";
import { uid } from "../timer";
import type { SetStore } from "./Companion";
import { IconButton, Modal } from "./UI";

import { examDays } from "../dates";
export function Planner({
  store,
  setStore,
  onClose,
}: {
  store: Store;
  setStore: SetStore;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const days = examDays(store.exam.date);
  return (
    <Modal
      title="Before you begin."
      subtitle="A little preparation makes room for a clearer mind."
      onClose={onClose}
    >
      <h3 className="subheading">Your study checklist</h3>
      {store.plan.length === 0 && (
        <p className="field-hint">
          Gather your books, fill a glass of water, choose a chapter. Add your
          own study ritual.
        </p>
      )}
      <div className="plan-list">
        {store.plan.map((item) => (
          <div className="plan-row" key={item.id}>
            <button
              className={`check-square ${item.done ? "checked" : ""}`}
              aria-label={`${item.done ? "Uncheck" : "Check"} ${item.title}`}
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  plan: s.plan.map((x) =>
                    x.id === item.id ? { ...x, done: !x.done } : x,
                  ),
                }))
              }
            >
              {item.done && <Check size={14} />}
            </button>
            <span className={item.done ? "struck" : ""}>{item.title}</span>
            <IconButton
              label={`Remove ${item.title}`}
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  plan: s.plan.filter((x) => x.id !== item.id),
                }))
              }
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            setStore((s) => ({
              ...s,
              plan: [...s.plan, { id: uid(), title: text.trim(), done: false }],
            }));
            setText("");
          }
        }}
      >
        <input
          aria-label="New checklist item"
          maxLength={500}
          placeholder="Add to your ritual…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="secondary-button"
          aria-label="Add checklist item"
          disabled={!text.trim()}
        >
          <Plus size={18} />
        </button>
      </form>
      {store.plan.some((x) => x.done) && (
        <button
          className="text-button"
          onClick={() =>
            setStore((s) => ({
              ...s,
              plan: s.plan.map((x) => ({ ...x, done: false })),
            }))
          }
        >
          Uncheck all for a new day
        </button>
      )}
      <div className="exam-section">
        <h3 className="subheading">
          <CalendarDays size={17} /> Something to work toward
        </h3>
        <div className="form-stack">
          <label>
            Exam or milestone
            <input
              maxLength={100}
              placeholder="e.g. Final exams"
              value={store.exam.name}
              onChange={(e) =>
                setStore((s) => ({
                  ...s,
                  exam: { ...s.exam, name: e.target.value },
                }))
              }
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={store.exam.date}
              onChange={(e) =>
                setStore((s) => ({
                  ...s,
                  exam: { ...s.exam, date: e.target.value },
                }))
              }
            />
          </label>
        </div>
        {days !== null && (
          <div className="exam-result">
            <strong>{Math.abs(days)}</strong>
            <span>
              {days > 0
                ? `days until ${store.exam.name || "your milestone"}`
                : days === 0
                  ? "Your milestone is today."
                  : `days since ${store.exam.name || "your milestone"}`}
            </span>
            <button
              className="text-button"
              onClick={() =>
                setStore((s) => ({ ...s, exam: { name: "", date: "" } }))
              }
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
