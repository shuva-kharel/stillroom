import { completeTask } from "../study";
import { StorageStatus } from "./StorageStatus";
import {
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Crosshair,
  Pencil,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import type { Store, Task } from "../types";
import { transition, uid } from "../timer";
import { IconButton, Modal } from "./UI";
import { Select } from "./Select";

export type SetStore = Dispatch<SetStateAction<Store>>;
export function Companion({
  store,
  setStore,
  toast,
  onClose,
}: {
  store: Store;
  setStore: SetStore;
  onClose: () => void;
  toast: (message: string, undo?: () => void) => void;
}) {
  const storage = useContext(StorageStatus);
  const [sheet, setSheet] = useState(
    () => matchMedia("(max-width:1050px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width:1050px)");
    const update = () => setSheet(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [selection, setSelection] = useState("");
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");
  const [editor, setEditor] = useState<Task | null>(null);
  const [noteSubject, setNoteSubject] = useState("");
  const [showDone, setShowDone] = useState(false);
  const activeTab = !store.preferences.layout.tasks
    ? "notes"
    : !store.preferences.layout.notes
      ? "tasks"
      : tab;
  useEffect(() => {
    if (noteSubject && !store.subjects.some((s) => s.id === noteSubject))
      setNoteSubject("");
  }, [store.subjects, noteSubject]);
  useEffect(() => {
    const open = () => setTab("notes");
    window.addEventListener("stillroom:notes", open);
    return () => window.removeEventListener("stillroom:notes", open);
  }, []);
  const pending = store.tasks.filter((t) => !t.done);
  const done = store.tasks.filter((t) => t.done);
  function remove(task: Task) {
    const index = store.tasks.findIndex((t) => t.id === task.id);
    setStore((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== task.id) }));
    toast("Task removed.", () =>
      setStore((s) => {
        const tasks = [...s.tasks];
        if (!tasks.some((t) => t.id === task.id))
          tasks.splice(Math.min(index, tasks.length), 0, task);
        return { ...s, tasks };
      }),
    );
  }
  function move(id: string, direction: number) {
    setStore((s) => {
      const tasks = [...s.tasks];
      const at = tasks.findIndex((t) => t.id === id);
      const visible = tasks.filter((t) => !t.done);
      const next = visible.findIndex((t) => t.id === id) + direction;
      if (next < 0 || next >= visible.length) return s;
      const other = tasks.findIndex((t) => t.id === visible[next].id);
      [tasks[at], tasks[other]] = [tasks[other], tasks[at]];
      return { ...s, tasks };
    });
  }
  function selectTask(task: Task) {
    setStore((s) => {
      const next = transition(
        s,
        { type: "subject", subjectId: task.subjectId },
        Date.now(),
        false,
      );
      return {
        ...next,
        timer: { ...next.timer, intention: task.title, taskId: task.id },
      };
    });
    toast("Session intention set.");
  }
  const content = (
    <aside className="companion" aria-label="Study companion">
      <div className="companion-heading">
        <span>Study companion</span>
        <IconButton label="Close study companion" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div
        className="companion-tabs"
        role="tablist"
        aria-label="Companion tools"
      >
        {store.preferences.layout.tasks && (
          <button
            role="tab"
            aria-selected={activeTab === "tasks"}
            onClick={() => setTab("tasks")}
          >
            Tasks <span className="count">{pending.length}</span>
          </button>
        )}
        {store.preferences.layout.notes && (
          <button
            role="tab"
            aria-selected={activeTab === "notes"}
            onClick={() => setTab("notes")}
          >
            Notes <Pencil size={13} />
          </button>
        )}
      </div>
      {activeTab === "tasks" ? (
        <div role="tabpanel" className="tasks-pane">
          <div className="section-heading">
            <h3>Tasks</h3>
            <IconButton
              label="Add task"
              onClick={() =>
                setEditor({
                  id: uid(),
                  title: "",
                  subjectId: store.timer.subjectId,
                  estimate: 1,
                  done: false,
                })
              }
            >
              <Plus size={18} />
            </IconButton>
          </div>
          {pending.length === 0 && (
            <p className="task-empty">
              Add a task to choose what to work on next.
            </p>
          )}
          <div className="task-list">
            {pending.map((task, index) => (
              <div
                className={`task-row ${store.timer.intention === task.title ? "selected-task" : ""}`}
                key={task.id}
              >
                <button
                  className="check-button"
                  aria-label={`Complete ${task.title}`}
                  onClick={() =>
                    setStore((s) => completeTask(s, task.id, Date.now()))
                  }
                >
                  <Circle size={18} />
                </button>
                <div className="task-content">
                  <button
                    className="task-title"
                    title="Use as session intention"
                    onClick={() => selectTask(task)}
                  >
                    {task.title}
                  </button>
                  <div className="task-meta">
                    <span>
                      {store.subjects.find((s) => s.id === task.subjectId)
                        ?.name ?? "General"}
                    </span>
                    {task.estimate > 0 && (
                      <span>
                        {task.estimate}{" "}
                        {task.estimate === 1 ? "session" : "sessions"}
                      </span>
                    )}
                  </div>
                  <div className="task-actions">
                    <IconButton
                      label={`Focus on ${task.title}`}
                      onClick={() => selectTask(task)}
                    >
                      <Crosshair size={14} />
                    </IconButton>
                    <IconButton
                      label={`Edit ${task.title}`}
                      onClick={() => setEditor(task)}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label={`Move ${task.title} up`}
                      disabled={index === 0}
                      onClick={() => move(task.id, -1)}
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      label={`Move ${task.title} down`}
                      disabled={index === pending.length - 1}
                      onClick={() => move(task.id, 1)}
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${task.title}`}
                      onClick={() => remove(task)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            className="add-task"
            onClick={() =>
              setEditor({
                id: uid(),
                title: "",
                subjectId: store.timer.subjectId,
                estimate: 1,
                done: false,
              })
            }
          >
            <Plus size={16} /> Add a task <kbd>↵</kbd>
          </button>
          {done.length > 0 && (
            <>
              <button
                className="completed-toggle"
                onClick={() => setShowDone(!showDone)}
              >
                <CheckCheck size={15} />
                {done.length} completed
                <ChevronRight size={14} className={showDone ? "rotate" : ""} />
              </button>
              {showDone &&
                done.map((task) => (
                  <div className="completed-task" key={task.id}>
                    <button
                      className="check-button"
                      aria-label={`Reopen ${task.title}`}
                      onClick={() =>
                        setStore((s) => ({
                          ...s,
                          tasks: s.tasks.map((t) =>
                            t.id === task.id ? { ...t, done: false } : t,
                          ),
                        }))
                      }
                    >
                      <Check size={16} />
                    </button>
                    <span>{task.title}</span>
                    <IconButton
                      label={`Delete ${task.title}`}
                      onClick={() => remove(task)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                ))}
            </>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="notes-pane">
          <div className="section-heading">
            <h3>Notes</h3>
            <span className="saved-indicator">
              <Check size={12} />{" "}
              {storage.saved ? "Saved locally" : "In memory"}
            </span>
          </div>
          <label className="field-label" htmlFor="note-subject">
            Notebook
          </label>
          <Select
            label="Notebook"
            value={noteSubject}
            onChange={setNoteSubject}
            options={[
              { value: "", label: "General scratchpad" },
              ...store.subjects.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <textarea
            onSelect={(e) =>
              setSelection(
                e.currentTarget.value.slice(
                  e.currentTarget.selectionStart,
                  e.currentTarget.selectionEnd,
                ),
              )
            }
            className="scratchpad"
            aria-label="Scratchpad notes"
            placeholder="An idea, a question, something to come back to…"
            value={store.notes[noteSubject] ?? ""}
            onChange={(e) =>
              setStore((s) => ({
                ...s,
                notes: { ...s.notes, [noteSubject]: e.target.value },
              }))
            }
          />
          <button
            className="secondary-button"
            onClick={() =>
              setEditor({
                id: uid(),
                title: (
                  selection || (store.notes[noteSubject] ?? "").split("\n")[0]
                ).slice(0, 500),
                subjectId: noteSubject,
                estimate: 1,
                done: false,
              })
            }
          >
            Create task from notes
          </button>
          <p className="field-hint">
            Select text to prefill a task, or use this button to edit the first
            line. Your original note stays intact.
          </p>
          <p className="field-hint">
            Your thoughts stay here, even when you close the room. Plain text,
            automatically saved.
          </p>
        </div>
      )}
      {editor && (
        <TaskEditor
          task={editor}
          store={store}
          onClose={() => setEditor(null)}
          onSave={(task) => {
            setStore((s) => ({
              ...s,
              tasks: s.tasks.some((t) => t.id === task.id)
                ? s.tasks.map((t) => (t.id === task.id ? task : t))
                : [...s.tasks, task],
            }));
            setEditor(null);
          }}
        />
      )}
    </aside>
  );
  return sheet ? (
    <Modal
      title="Study companion"
      className="companion-sheet"
      onClose={onClose}
    >
      {content}
    </Modal>
  ) : (
    content
  );
}
function TaskEditor({
  task,
  store,
  onClose,
  onSave,
}: {
  task: Task;
  store: Store;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [draft, setDraft] = useState(task);
  return (
    <Modal
      title={task.title ? "Edit task" : "A small next step"}
      subtitle="Give your next session somewhere to begin."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.title.trim())
            onSave({ ...draft, title: draft.title.trim() });
        }}
        className="form-stack"
      >
        <label>
          What will you work on?
          <input
            autoFocus
            required
            maxLength={500}
            placeholder="Read chapter three"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Subject
            <Select
              label="Task subject"
              value={draft.subjectId}
              onChange={(subjectId) => setDraft({ ...draft, subjectId })}
              options={[
                { value: "", label: "General" },
                ...store.subjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </label>
          <label>
            Estimated sessions
            <input
              type="number"
              min="0"
              max="20"
              step="1"
              required
              value={draft.estimate}
              onChange={(e) =>
                setDraft({ ...draft, estimate: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={!draft.title.trim()}>
            Save task
          </button>
        </div>
      </form>
    </Modal>
  );
}
