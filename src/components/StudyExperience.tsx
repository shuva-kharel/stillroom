import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  ArrowRight,
  Bookmark,
  PanelsTopLeft,
  Command as CommandIcon,
  NotebookPen,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import {
  elapsed,
  formatClock,
  remaining,
  transition,
  type TimerAction,
} from "../timer";
import { resumePreview, resumeStudy } from "../study";
import { MiniTimer } from "./MiniTimer";
import { Modal } from "./UI";
import type { Command } from "./CommandPalette";
import { builtinRooms, applyRoom } from "../roomPresets";
import { soundIds } from "../preferences";
import { mixer } from "../sound/mixer";
import { alarms } from "../sound/alarms";
import type { ToolTab } from "./StudyTools";
const Bookmarks = lazy(() => import("./Bookmarks"));
const Tools = lazy(() => import("./StudyTools")),
  Capture = lazy(() =>
    import("./StudyTools").then((m) => ({ default: m.CaptureThought })),
  ),
  Palette = lazy(() => import("./CommandPalette"));
export default function StudyExperience({
  store,
  setStore,
  now,
  act,
  openSettings,
  openHistory,
  focus,
  owner,
}: {
  store: Store;
  setStore: SetStore;
  now: number;
  act: (a: TimerAction) => void;
  openSettings: () => void;
  openHistory: () => void;
  focus: () => void;
  owner: boolean;
}) {
  const [more, setMore] = useState(false);
  const [places, setPlaces] = useState<"quick" | "list" | null>(null);
  useEffect(() => {
    const open = () => setPlaces("quick");
    window.addEventListener("stillroom:save-place", open);
    return () => window.removeEventListener("stillroom:save-place", open);
  }, []);
  const [tool, setTool] = useState<ToolTab | null>(null),
    [capture, setCapture] = useState(false),
    [palette, setPalette] = useState(false),
    [wrap, setWrap] = useState(""),
    [breakDismiss, setBreakDismiss] = useState("");
  const [reflectionId, setReflectionId] = useState("");
  const count = useRef(store.history.length);
  const timerId = useRef(store.timer.id);
  useEffect(() => {
    if (store.history.length > count.current && owner) {
      const last = store.history.at(-1);
      if (last && Date.now() - last.endedAt < 2000) setWrap(last.id);
    }
    count.current = store.history.length;
  }, [store.history, owner]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.altKey &&
        e.code === "KeyK" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !document.querySelector("dialog[open]") &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest('input,textarea,select,[contenteditable="true"]')
        )
      ) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const t = store.timer,
      p = t.practice;
    if (
      !owner ||
      t.mode !== "practice" ||
      !p ||
      !p.checkpoint ||
      t.runningSince === null
    )
      return;
    const n = Math.floor(elapsed(t, now) / (p.checkpoint * 60000));
    if (n > p.passed) {
      setStore((s) =>
        s.timer.id === t.id
          ? {
              ...s,
              timer: {
                ...s.timer,
                practice: { ...s.timer.practice!, passed: n },
              },
            }
          : s,
      );
      const near = elapsed(t, now) % (p.checkpoint * 60000) < 1500;
      if (p.sound && near && timerId.current === t.id && !document.hidden)
        void alarms
          .play("wood", { ...store.preferences.alarms, repeat: 1 })
          .catch(() => {});
    }
    timerId.current = t.id;
  }, [now, store.timer, store.preferences.alarms, owner, setStore]);
  const next = [...store.history]
    .reverse()
    .find(
      (h) =>
        h.subjectId === store.timer.subjectId &&
        (!store.timer.taskId || h.taskId === store.timer.taskId) &&
        store.study.reflections[h.id]?.next,
    );
  const reflection = next ? store.study.reflections[next.id] : null;
  const changeMode = (
    mode: "focus" | "countdown" | "stopwatch" | "short" | "long",
  ) => {
    if (
      (store.timer.runningSince !== null || elapsed(store.timer, now) > 0) &&
      mode !== store.timer.mode &&
      !confirm(
        "Change timing mode and save the current actual study time as partial?",
      )
    )
      return;
    act({ type: "mode", mode });
    setStore((s) => ({
      ...s,
      preferences: {
        ...s.preferences,
        view:
          mode === "countdown"
            ? "timer"
            : mode === "stopwatch"
              ? "stopwatch"
              : "pomodoro",
      },
    }));
  };
  const commands: Command[] = [
    {
      id: "toggle",
      label: "Start / pause timer",
      run: () => act({ type: "toggle" }),
    },
    { id: "settings", label: "Open settings", run: openSettings },
    { id: "history", label: "Open history", run: openHistory },
    { id: "focus", label: "Enter Focus View", run: focus },
    {
      id: "notes",
      label: "Open notes",
      run: () => {
        setStore((s) => ({
          ...s,
          preferences: {
            ...s.preferences,
            layout: {
              ...s.preferences.layout,
              notes: true,
              companionOpen: true,
            },
          },
        }));
        requestAnimationFrame(() =>
          window.dispatchEvent(new Event("stillroom:notes")),
        );
      },
    },
    {
      id: "mute",
      label: "Mute / unmute ambience",
      run: () => mixer.mute(!mixer.muted),
    },
    ...(["focus", "countdown", "stopwatch", "short", "long"] as const).map(
      (mode) => ({
        id: mode,
        label: `Change mode: ${mode}`,
        run: () => changeMode(mode),
      }),
    ),
    {
      id: "clock",
      label: "Show wall clock",
      run: () =>
        setStore((s) => ({
          ...s,
          preferences: { ...s.preferences, view: "clock" },
        })),
    },
    ...(
      ["reviews", "practice", "weekly", "reflections", "parking"] as ToolTab[]
    ).map((t) => ({ id: t, label: `Open ${t}`, run: () => setTool(t) })),
    ...store.subjects.map((s) => ({
      id: s.id,
      label: `Study subject: ${s.name}`,
      run: () => act({ type: "subject", subjectId: s.id }),
    })),
    ...store.tasks
      .filter((t) => !t.done)
      .map((t) => ({
        id: t.id,
        label: `Select task: ${t.title}`,
        run: () =>
          setStore((s) => {
            const n = transition(
              s,
              { type: "subject", subjectId: t.subjectId },
              Date.now(),
              false,
            );
            return {
              ...n,
              timer: { ...n.timer, intention: t.title, taskId: t.id },
            };
          }),
      })),
    ...[...builtinRooms, ...store.preferences.rooms].map((r) => ({
      id: r.id,
      label: `Apply room: ${r.name}`,
      run: () => {
        mixer.stopAll();
        setStore((s) => applyRoom(s, r));
      },
    })),
    ...soundIds.map((id) => ({
      id: `sound-${id}`,
      label: `Toggle ${id} ambience`,
      run: () => {
        if (mixer.active.includes(id)) mixer.stop(id);
        else
          void mixer
            .start(id, store.preferences.mixer.levels[id] || 0.3)
            .catch(() => {});
      },
    })),
  ];
  const breakOpen =
    store.study.breakScreen.enabled &&
    (store.timer.mode === "short" || store.timer.mode === "long") &&
    store.timer.runningSince !== null &&
    breakDismiss !== store.timer.id &&
    !places &&
    !tool &&
    !capture &&
    !palette &&
    !document.querySelector("dialog[open]:not(.break-dialog)");
  return (
    <div className="study-experience">
      <button
        className="utility-button"
        aria-label="More study actions"
        aria-haspopup="dialog"
        onClick={() => setMore(true)}
      >
        <MoreHorizontal size={19} />
        <span>More</span>
      </button>
      <MiniTimer store={store} now={now} act={act} hideTrigger owner={owner} />
      {more && (
        <Modal title="Study actions" onClose={() => setMore(false)}>
          <div className="action-menu">
            <button
              className="resume-button"
              onClick={() => {
                setStore(resumeStudy);
                setMore(false);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLButtonElement>(".start-button")
                    ?.focus(),
                );
              }}
            >
              <ArrowRight size={18} />
              <span>
                <strong>Continue studying</strong>
                <small>{resumePreview(store)}</small>
              </span>
            </button>
            <button
              onClick={() => {
                setMore(false);
                setPlaces("list");
              }}
            >
              <Bookmark size={18} />
              Saved places
            </button>
            <button
              onClick={() => {
                setMore(false);
                setCapture(true);
              }}
            >
              <Bookmark size={18} />
              Save for later
            </button>
            <button
              onClick={() => {
                setMore(false);
                window.dispatchEvent(new Event("stillroom:mini"));
              }}
            >
              <PanelsTopLeft size={18} />
              Mini timer
            </button>
            <button
              onClick={() => {
                setMore(false);
                setPalette(true);
              }}
            >
              <CommandIcon size={18} />
              Command palette <kbd>Alt K</kbd>
            </button>
            <button
              onClick={() => {
                setMore(false);
                setTool(
                  store.timer.mode === "practice" ? "practice" : "reviews",
                );
              }}
            >
              <NotebookPen size={18} />
              Study tools
            </button>
          </div>
        </Modal>
      )}
      {places &&
        createPortal(
          <Suspense fallback={null}>
            <Bookmarks
              store={store}
              setStore={setStore}
              quick={places === "quick"}
              onClose={() => setPlaces(null)}
            />
          </Suspense>,
          document.body,
        )}
      {reflection &&
        document.getElementById("session-next-step") &&
        createPortal(
          <details className="next-step">
            <summary>
              <span>Next step</span>
              <span className="next-step-preview">{reflection.next}</span>
            </summary>
            <p tabIndex={0}>{reflection.next}</p>
          </details>,
          document.getElementById("session-next-step")!,
        )}
      {wrap &&
        !alarms.active &&
        document.getElementById("room-feedback") &&
        createPortal(
          <div className="wrap-up" role="status">
            <span>Leave a note for your next session?</span>
            <button
              className="text-button"
              onClick={() => {
                setWrap("");
                setReflectionId(wrap);
                setTool("reflections");
              }}
            >
              Reflect
            </button>
            <button
              className="text-button"
              onClick={() => {
                setWrap("");
                setTool("parking");
              }}
            >
              Review parked thoughts
            </button>
            <button className="text-button" onClick={() => setWrap("")}>
              Skip
            </button>
          </div>,
          document.getElementById("room-feedback")!,
        )}
      <Suspense fallback={<p>Opening study tools…</p>}>
        {tool && (
          <Tools
            store={store}
            setStore={setStore}
            now={now}
            act={act}
            initial={tool}
            reflectionId={reflectionId}
            onClose={() => setTool(null)}
          />
        )}{" "}
        {capture && (
          <Capture
            setStore={setStore}
            act={act}
            onClose={() => setCapture(false)}
          />
        )}{" "}
        {palette && (
          <Palette
            commands={commands}
            onClose={() => setPalette(false)}
            duration={(seconds) => {
              if (
                (store.timer.runningSince !== null ||
                  elapsed(store.timer, now) > 0) &&
                !confirm(
                  "Prepare this countdown and save the current actual time as partial?",
                )
              )
                return;
              setStore((s) => {
                const next = {
                  ...s,
                  settings: { ...s.settings, countdown: seconds },
                  preferences: { ...s.preferences, view: "timer" as const },
                };
                return transition(
                  transition(
                    next,
                    { type: "mode", mode: "countdown" },
                    Date.now(),
                    false,
                  ),
                  { type: "apply-duration" },
                  Date.now(),
                  false,
                );
              });
            }}
          />
        )}
      </Suspense>
      {breakOpen && (
        <Modal
          className="break-dialog"
          title="A little breathing room"
          onClose={() => setBreakDismiss(store.timer.id)}
        >
          <div className="break-screen">
            <h2>{formatClock(remaining(store.timer, now))}</h2>
            {store.study.breakScreen.water && (
              <p>A glass of water, if you’d like one.</p>
            )}
            {store.study.breakScreen.stretch && (
              <p>
                Let your shoulders relax. Look away from the page for a moment.
              </p>
            )}
            {store.study.breakScreen.breathing && (
              <div
                className="breathing-orb"
                aria-label="Optional slow breathing animation"
              />
            )}
            <button
              className="primary-button"
              onClick={() => setBreakDismiss(store.timer.id)}
            >
              Return to room
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
