import { useEffect, useRef, useState } from "react";
import { Bookmark, ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import {
  bookmarkSchema,
  bookmarkSubject,
  bookmarkText,
  currentBookmark,
  removeBookmark,
  saveBookmark,
  validResourceUrl,
  type StudyBookmark,
} from "../bookmarks";
import { uid } from "../timer";
import { Modal, IconButton } from "./UI";
import { Select } from "./Select";
import { Toggle } from "./Controls";

export default function Bookmarks({
  store,
  setStore,
  onClose,
  quick = false,
}: {
  store: Store;
  setStore: SetStore;
  onClose: () => void;
  quick?: boolean;
}) {
  const initialSubject = store.subjects.some(
    (s) => s.id === store.timer.subjectId,
  )
    ? store.timer.subjectId
    : "";
  const makeDraft = (subjectId: string): StudyBookmark => ({
    id: uid(),
    label: "",
    resource: "",
    location: "",
    url: "",
    subjectId,
    taskId:
      store.tasks.find(
        (t) =>
          t.id === store.timer.taskId && t.subjectId === subjectId && !t.done,
      )?.id ?? "",
  });
  const [subject, setSubject] = useState(initialSubject);
  const selectedSubject = store.subjects.some((s) => s.id === subject)
    ? subject
    : "";
  const [draft, setDraft] = useState<StudyBookmark | null>(() =>
    quick ? makeDraft(initialSubject) : null,
  );
  const [current, setCurrent] = useState(true);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<{
    bookmark: StudyBookmark;
    current: boolean;
  } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (draft) labelInput.current?.focus();
  }, [draft?.id]);
  const finishEditor = () => {
    if (quick) onClose();
    else {
      setDraft(null);
      requestAnimationFrame(() => addButton.current?.focus());
    }
  };
  const subjectOptions = [
    { value: "", label: "Independent study" },
    ...store.subjects.map((s) => ({ value: s.id, label: s.name })),
  ];
  return (
    <Modal title={draft ? "Save your place" : "Saved places"} onClose={onClose}>
      {draft ? (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = bookmarkSchema.safeParse(draft);
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
            setStore((s) => saveBookmark(s, parsed.data, current));
            finishEditor();
          }}
        >
          <p className="field-hint">
            A place to return to, separate from what you completed. Saving
            leaves your timer running.
          </p>
          <label>
            Bookmark label
            <input
              ref={labelInput}
              required
              maxLength={100}
              value={draft.label}
              placeholder="Integration by parts"
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          <label>
            Resource name
            <input
              maxLength={200}
              value={draft.resource}
              placeholder="Anton Calculus"
              onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
            />
          </label>
          <label>
            Page, chapter, question or timestamp
            <input
              maxLength={200}
              value={draft.location}
              placeholder="Page 42 · question 7"
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </label>
          <label>
            Resource URL (optional)
            <input
              type="text"
              inputMode="url"
              maxLength={2048}
              value={draft.url}
              placeholder="https://…"
              onChange={(e) => {
                setError("");
                setDraft({ ...draft, url: e.target.value });
              }}
            />
          </label>
          <Select
            label="Bookmark subject"
            value={
              store.subjects.some((s) => s.id === draft.subjectId)
                ? draft.subjectId
                : ""
            }
            options={subjectOptions}
            onChange={(subjectId) =>
              setDraft({ ...draft, subjectId, taskId: "" })
            }
          />
          <Select
            label="Bookmark task"
            value={
              store.tasks.some(
                (t) => t.id === draft.taskId && t.subjectId === draft.subjectId,
              )
                ? draft.taskId
                : ""
            }
            options={[
              { value: "", label: "No task" },
              ...store.tasks
                .filter(
                  (t) =>
                    t.subjectId === draft.subjectId &&
                    (!t.done || t.id === draft.taskId),
                )
                .map((t) => ({ value: t.id, label: t.title })),
            ]}
            onChange={(taskId) => setDraft({ ...draft, taskId })}
          />
          <Toggle
            label="Use as current resume point"
            checked={current}
            onChange={setCurrent}
          />
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={finishEditor}
            >
              Cancel
            </button>
            <button className="primary-button">Save bookmark</button>
          </div>
        </form>
      ) : (
        <div className="form-stack">
          <Select
            label="Saved places subject"
            value={selectedSubject}
            options={subjectOptions}
            onChange={setSubject}
          />
          <button
            ref={addButton}
            className="secondary-button"
            onClick={() => {
              setDraft(makeDraft(selectedSubject));
              setCurrent(true);
              setError("");
            }}
          >
            Add bookmark
          </button>
          {removed && (
            <div className="bookmark-undo" role="status">
              Bookmark removed.{" "}
              <button
                className="text-button"
                onClick={() => {
                  setStore((s) =>
                    s.study.bookmarks.some((b) => b.id === removed.bookmark.id)
                      ? s
                      : saveBookmark(
                          s,
                          removed.bookmark,
                          removed.current &&
                            !currentBookmark(
                              s,
                              bookmarkSubject(s, removed.bookmark),
                            ),
                        ),
                  );
                  setRemoved(null);
                }}
              >
                Undo
              </button>
            </div>
          )}
          {!store.study.bookmarks.some(
            (b) => bookmarkSubject(store, b) === selectedSubject,
          ) && (
            <p className="field-hint">
              Save a page, question, or timestamp for this subject.
            </p>
          )}
          {store.study.bookmarks
            .filter((b) => bookmarkSubject(store, b) === selectedSubject)
            .map((b) => (
              <article className="bookmark-item" key={b.id}>
                <strong>{b.label}</strong>
                <p>{[b.resource, b.location].filter(Boolean).join(" · ")}</p>
                {store.tasks.find((t) => t.id === b.taskId) && (
                  <small>
                    {store.tasks.find((t) => t.id === b.taskId)?.title}
                  </small>
                )}
                <div className="bookmark-actions">
                  <button
                    className="text-button"
                    aria-pressed={
                      currentBookmark(store, selectedSubject)?.id === b.id
                    }
                    onClick={() => setStore((s) => saveBookmark(s, b, true))}
                  >
                    <Bookmark size={14} />
                    {currentBookmark(store, selectedSubject)?.id === b.id
                      ? "Current resume point"
                      : "Use as resume point"}
                  </button>
                  {b.url && validResourceUrl(b.url) && (
                    <a
                      className="text-button"
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open resource for ${b.label}`}
                    >
                      <ExternalLink size={14} />
                      Open
                    </a>
                  )}
                  <IconButton
                    label={`Edit bookmark ${b.label}`}
                    onClick={() => {
                      setDraft(b);
                      setCurrent(
                        currentBookmark(store, selectedSubject)?.id === b.id,
                      );
                      setError("");
                    }}
                  >
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    label={`Delete bookmark ${b.label}`}
                    onClick={() => {
                      setRemoved({
                        bookmark: b,
                        current:
                          currentBookmark(store, selectedSubject)?.id === b.id,
                      });
                      setStore((s) => removeBookmark(s, b.id));
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
                <span className="sr-only">{bookmarkText(b)}</span>
              </article>
            ))}
        </div>
      )}
    </Modal>
  );
}
