import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Store } from "../types";
import { transition, uid } from "../timer";
import type { SetStore } from "./Companion";
import { Section } from "./Controls";
import { IconButton } from "./UI";
export function SubjectsPanel({
  store,
  setStore,
}: {
  store: Store;
  setStore: SetStore;
}) {
  const [name, setName] = useState(""),
    [color, setColor] = useState("#c7aa76");
  function remove(id: string) {
    if (
      !confirm(
        "Delete this subject? Its tasks and notes move to General; history keeps its original subject name.",
      )
    )
      return;
    setStore((s) => {
      const next =
        s.timer.subjectId === id
          ? transition(s, { type: "subject", subjectId: "" }, Date.now(), false)
          : s;
      const notes = { ...next.notes };
      if (notes[id])
        notes[""] = [notes[""], notes[id]].filter(Boolean).join("\n\n");
      delete notes[id];
      return {
        ...next,
        notes,
        subjects: next.subjects.filter((x) => x.id !== id),
        tasks: next.tasks.map((t) =>
          t.subjectId === id ? { ...t, subjectId: "" } : t,
        ),
      };
    });
  }
  return (
    <Section
      title="A shelf for every subject"
      description="Rename directly below. Changes save automatically when you leave the field."
    >
      <div className="subject-list">
        {store.subjects.map((s) => (
          <div className="subject-edit" key={s.id}>
            <input
              type="color"
              aria-label={`Color for ${s.name}`}
              value={s.color}
              onChange={(e) =>
                setStore((old) => ({
                  ...old,
                  subjects: old.subjects.map((x) =>
                    x.id === s.id ? { ...x, color: e.target.value } : x,
                  ),
                }))
              }
            />
            <input
              aria-label={`Rename ${s.name}`}
              defaultValue={s.name}
              maxLength={100}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name)
                  setStore((old) => ({
                    ...old,
                    subjects: old.subjects.map((x) =>
                      x.id === s.id ? { ...x, name } : x,
                    ),
                  }));
                else e.target.value = s.name;
              }}
            />
            <IconButton
              label={`Delete subject ${s.name}`}
              onClick={() => remove(s.id)}
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
          if (name.trim()) {
            setStore((s) => ({
              ...s,
              subjects: [
                ...s.subjects,
                { id: uid(), name: name.trim(), color },
              ],
            }));
            setName("");
          }
        }}
      >
        <input
          type="color"
          aria-label="New subject color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <input
          aria-label="New subject name"
          placeholder="A new subject…"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="secondary-button"
          disabled={!name.trim()}
          aria-label="Add subject"
        >
          <Plus size={16} />
        </button>
      </form>
      <p className="field-hint">
        Changing the timer's active subject saves its partial work. Renaming or
        recoloring subjects never changes timing.
      </p>
    </Section>
  );
}
