import { useState } from "react";
import { attachReflection, type Reflection } from "../study";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { formatDuration } from "../timer";
import { Select } from "./Select";
export default function ReflectionPanel({
  store,
  setStore,
  initialSessionId,
}: {
  store: Store;
  setStore: SetStore;
  initialSessionId?: string;
}) {
  const [selected, select] = useState(
    initialSessionId || store.history.at(-1)?.id || "",
  );
  const session = store.history.find((h) => h.id === selected);
  return (
    <div className="form-stack">
      <p className="field-hint">
        Optional notes on the work itself. Reflections never affect your timer
        or session count.
      </p>
      {store.history.length ? (
        <>
          <Select
            label="Session to reflect on"
            value={selected}
            onChange={select}
            options={[...store.history].reverse().map((h) => ({
              value: h.id,
              label: `${h.subjectName} · ${new Date(h.endedAt).toLocaleString()} · ${formatDuration(h.duration)}`,
            }))}
          />
          {session && (
            <ReflectionEditor
              key={selected}
              initial={store.study.reflections[selected]}
              practice={!!session.practice}
              onSave={(r) => setStore((s) => attachReflection(s, selected, r))}
            />
          )}
        </>
      ) : (
        <p className="empty-state">Your recorded sessions will appear here.</p>
      )}
    </div>
  );
}
export function ReflectionEditor({
  initial,
  practice,
  onSave,
}: {
  initial?: Reflection;
  practice: boolean;
  onSave: (r: Reflection) => void;
}) {
  const [draft, setDraft] = useState<Reflection>(
      initial ?? { finished: "", next: "", rating: "", score: "" },
    ),
    [saved, setSaved] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
        setSaved(true);
      }}
      onChange={() => setSaved(false)}
    >
      <label>
        What did you complete?
        <textarea
          maxLength={2000}
          value={draft.finished}
          onChange={(e) => setDraft({ ...draft, finished: e.target.value })}
        />
      </label>
      <label>
        Where will you continue?
        <textarea
          maxLength={2000}
          value={draft.next}
          onChange={(e) => setDraft({ ...draft, next: e.target.value })}
        />
      </label>
      <Select
        label="How was my focus?"
        value={draft.rating}
        onChange={(v) => {
          setSaved(false);
          setDraft({ ...draft, rating: v as Reflection["rating"] });
        }}
        options={[
          { value: "", label: "Unrated" },
          ...["focused", "mixed", "distracted"].map((v) => ({
            value: v,
            label: v[0].toUpperCase() + v.slice(1),
          })),
        ]}
      />
      {practice && (
        <label>
          Score (optional)
          <input
            maxLength={100}
            placeholder="e.g. 18 / 25 — entered by you"
            value={draft.score}
            onChange={(e) => setDraft({ ...draft, score: e.target.value })}
          />
        </label>
      )}
      <button className="primary-button">
        {saved ? "Reflection updated" : "Save reflection"}
      </button>
    </form>
  );
}
