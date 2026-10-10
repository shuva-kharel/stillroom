import { lazy, Suspense, useState } from "react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { Modal } from "./UI";
import { Toggle } from "./Controls";
import { Select } from "./Select";
import { uid, type TimerAction } from "../timer";
import { downloadRoom, parsePortableRoom } from "../portableRoom";
import type { RoomPreset } from "../preferences";
import { TimerDisplay } from "../display/TimerDisplay";
import { backgroundCSS } from "../backgrounds/catalog";
import { applyRoom } from "../roomPresets";
import { mixer } from "../sound/mixer";
const Reviews = lazy(() => import("./ReviewQueue")),
  Practice = lazy(() => import("./PracticePanel")),
  Weekly = lazy(() => import("./WeeklyReview")),
  Reflections = lazy(() => import("./ReflectionPanel"));
export type ToolTab =
  | "reviews"
  | "practice"
  | "weekly"
  | "reflections"
  | "parking"
  | "share"
  | "break";
export default function StudyTools({
  store,
  setStore,
  now,
  act,
  onClose,
  initial = "reviews",
}: {
  store: Store;
  setStore: SetStore;
  now: number;
  act: (a: TimerAction) => void;
  onClose: () => void;
  initial?: ToolTab;
}) {
  const [tab, setTab] = useState<ToolTab>(initial);
  return (
    <Modal
      title="A little more room"
      subtitle="Useful tools, here when you need them."
      onClose={onClose}
      wide
    >
      <div className="study-tool-shell">
        <Select
          label="Study tool"
          value={tab}
          onChange={(v) => setTab(v as ToolTab)}
          options={[
            { value: "reviews", label: "Revision queue" },
            { value: "practice", label: "Exam practice" },
            { value: "weekly", label: "Weekly review" },
            { value: "reflections", label: "Session reflections" },
            { value: "parking", label: "Distraction parking lot" },
            { value: "share", label: "Share a room preset" },
            { value: "break", label: "Break screen" },
          ]}
        />
        <Suspense fallback={<p>Opening your tools…</p>}>
          {tab === "reviews" && (
            <Reviews store={store} setStore={setStore} onStudy={onClose} />
          )}{" "}
          {tab === "practice" && (
            <Practice
              store={store}
              setStore={setStore}
              now={now}
              act={act}
              onFinish={() => setTab("reflections")}
            />
          )}{" "}
          {tab === "weekly" && <Weekly store={store} setStore={setStore} />}{" "}
          {tab === "reflections" && (
            <Reflections store={store} setStore={setStore} />
          )}{" "}
          {tab === "parking" && <Parking store={store} setStore={setStore} />}{" "}
          {tab === "share" && <ShareRoom store={store} setStore={setStore} />}{" "}
          {tab === "break" && (
            <div className="form-stack">
              <p className="field-hint">
                An optional, dismissible screen during breaks. All suggestions
                are optional.
              </p>
              {(["enabled", "water", "stretch", "breathing"] as const).map(
                (k) => (
                  <Toggle
                    key={k}
                    label={
                      {
                        enabled: "Offer a break screen",
                        water: "Water reminder",
                        stretch: "Gentle stretching suggestion",
                        breathing: "Slow breathing animation",
                      }[k]
                    }
                    checked={store.study.breakScreen[k]}
                    onChange={(v) =>
                      setStore((s) => ({
                        ...s,
                        study: {
                          ...s.study,
                          breakScreen: { ...s.study.breakScreen, [k]: v },
                        },
                      }))
                    }
                  />
                ),
              )}
            </div>
          )}
        </Suspense>
      </div>
    </Modal>
  );
}
export function CaptureThought({
  setStore,
  act,
  onClose,
}: {
  setStore: SetStore;
  act: (a: TimerAction) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(""),
    [pause, setPause] = useState(false);
  return (
    <Modal
      title="Save for later"
      subtitle="Put it here, then return to your study."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setStore((s) => ({
            ...s,
            study: {
              ...s.study,
              parking: [
                ...s.study.parking,
                {
                  id: uid(),
                  text: text.trim(),
                  createdAt: Date.now(),
                  resolved: false,
                },
              ],
            },
          }));
          if (pause) act({ type: "pause" });
          onClose();
        }}
      >
        <label>
          A thought to come back to
          <textarea
            autoFocus
            required
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <Toggle
          label="Pause the timer when saving"
          checked={pause}
          onChange={setPause}
        />
        <button className="primary-button">Save thought & return</button>
      </form>
    </Modal>
  );
}
function Parking({ store, setStore }: { store: Store; setStore: SetStore }) {
  return (
    <div className="form-stack">
      <p className="field-hint">
        Thoughts you set aside. Resolve them when you have room.
      </p>
      {!store.study.parking.length && (
        <p className="empty-state">
          Nothing parked here. Use “Save for later” while studying.
        </p>
      )}
      {store.study.parking.map((item) => (
        <article className="tool-card" key={item.id}>
          <p className={item.resolved ? "resolved" : ""}>{item.text}</p>
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  study: {
                    ...s.study,
                    parking: s.study.parking.map((x) =>
                      x.id === item.id ? { ...x, resolved: !x.resolved } : x,
                    ),
                  },
                }))
              }
            >
              {item.resolved ? "Reopen" : "Mark resolved"}
            </button>
            <button
              className="text-button"
              disabled={item.resolved}
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  tasks: [
                    ...s.tasks,
                    {
                      id: uid(),
                      title: item.text.slice(0, 500),
                      subjectId: s.timer.subjectId,
                      estimate: 0,
                      done: false,
                    },
                  ],
                  study: {
                    ...s.study,
                    parking: s.study.parking.map((x) =>
                      x.id === item.id ? { ...x, resolved: true } : x,
                    ),
                  },
                }))
              }
            >
              Convert to task
            </button>
            <button
              className="text-button"
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  study: {
                    ...s.study,
                    parking: s.study.parking.filter((x) => x.id !== item.id),
                  },
                }))
              }
            >
              Delete thought
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
function ShareRoom({ store, setStore }: { store: Store; setStore: SetStore }) {
  const [room, setRoom] = useState<RoomPreset | null>(null),
    [error, setError] = useState("");
  return (
    <div className="form-stack">
      <p className="field-hint">
        Portable presets contain only appearance, timer display, backgrounds,
        layout, and mixer levels. Subjects, tasks, notes, history, greetings,
        Spotify links, and uploaded files are excluded. Upload backgrounds are
        replaced by a solid-color fallback.
      </p>
      <button className="secondary-button" onClick={() => downloadRoom(store)}>
        Export shareable room
      </button>
      <label>
        Preview a room preset
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            setRoom(null);
            if (!f) return;
            try {
              if (f.size > 200000)
                throw Error("Choose a room preset under 200 KB.");
              setRoom(parsePortableRoom(JSON.parse(await f.text())));
              setError("");
            } catch {
              setError(
                "This is not a valid portable Stillroom room preset. Personal backups belong in Data & Privacy.",
              );
            }
          }}
        />
      </label>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {room && (
        <div className="tool-card" data-theme={room.theme}>
          <h3>{room.name}</h3>
          <div
            className="portable-preview"
            style={{ background: backgroundCSS(room.background) }}
          >
            <TimerDisplay
              text="25:00"
              display={{ ...room.display, size: 65 }}
              progress={0.3}
              running={false}
            />
          </div>
          <p className="field-hint">
            Applying changes appearance and mixer levels only. No audio starts
            automatically.
          </p>
          <button
            className="primary-button"
            onClick={() => {
              mixer.stopAll();
              setStore((s) => applyRoom(s, room));
              setRoom(null);
            }}
          >
            Apply previewed room
          </button>
        </div>
      )}
    </div>
  );
}
