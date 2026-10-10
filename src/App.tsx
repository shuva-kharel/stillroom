import { createPortal } from "react-dom";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Headphones,
  Hourglass,
  Image,
  Keyboard,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Square,
  Timer,
  X,
} from "lucide-react";
import { StorageStatus } from "./components/StorageStatus";
import StudyExperience from "./components/StudyExperience";
import { useRoom } from "./hooks/useRoom";
import {
  activeSegments,
  elapsed,
  formatClock,
  formatDuration,
  localDay,
  remaining,
  timeOnDay,
  transition,
} from "./timer";
import type { Preferences } from "./preferences";
import { Background } from "./backgrounds/Background";
import { TimerDisplay, wallClock } from "./display/TimerDisplay";
import { Companion } from "./components/Companion";
import { IconButton } from "./components/UI";
import { Select } from "./components/Select";
import { CountdownSetup, LapTools } from "./components/TimingTools";
import { examDays } from "./dates";
import { mixer } from "./sound/mixer";
import { alarms } from "./sound/alarms";
import "./styles.css";
import "./studio.css";
import "./study.css";
import "./room.css";
import OfflineStatus from "./components/OfflineStatus";
const Settings = lazy(() => import("./components/Settings"));
const History = lazy(() =>
  import("./components/History").then((m) => ({ default: m.History })),
);
const Planner = lazy(() =>
  import("./components/Planner").then((m) => ({ default: m.Planner })),
);
const SpotifyPanel = lazy(() => import("./components/SpotifyPanel"));
const views = [
  { id: "timer", label: "Timer", icon: Hourglass },
  { id: "clock", label: "Clock", icon: Clock3 },
  { id: "pomodoro", label: "Pomodoro", icon: Timer },
  { id: "stopwatch", label: "Stopwatch", icon: RotateCcw },
] as const;
export default function App() {
  const {
    store,
    setStore,
    now,
    act,
    update,
    notification,
    setNotification,
    toast,
    storageError,
    saved,
    ownership,
    takeOver,
  } = useRoom();
  const p = store.preferences;
  const [overlay, setOverlay] = useState<
      "settings" | "history" | "planner" | null
    >(null),
    [section, setSection] = useState("room"),
    [focusView, setFocusView] = useState(false),
    [soundBusy, setSoundBusy] = useState(false),
    [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useSyncExternalStore(mixer.subscribe, mixer.getSnapshot);
  useSyncExternalStore(alarms.subscribe, alarms.getSnapshot);
  const openSettings = useCallback((category = "room") => {
    setSection(category);
    setOverlay("settings");
  }, []);
  const toggleFocus = useCallback(
    () =>
      setFocusView((current) => {
        if (current && document.fullscreenElement)
          void document.exitFullscreen().catch(() => {});
        return !current;
      }),
    [],
  );
  const running = store.timer.runningSince !== null;
  const clockView = p.view === "clock";
  const total = elapsed(store.timer, now);
  const progress =
    store.timer.mode === "stopwatch"
      ? (total % 3600000) / 3600000
      : total / store.timer.duration;
  let digits = formatClock(
    remaining(store.timer, now),
    store.timer.mode === "stopwatch",
  );
  if (remaining(store.timer, now) >= 3600000) {
    const secs =
      store.timer.mode === "stopwatch"
        ? Math.floor(total / 1000)
        : Math.ceil(remaining(store.timer, now) / 1000);
    digits = `${Math.floor(secs / 3600)
      .toString()
      .padStart(2, "0")}:${Math.floor((secs % 3600) / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;
  }
  if (!p.display.seconds) digits = digits.slice(0, -3);
  if (clockView) digits = wallClock(now, p.clock);
  function selectView(view: Preferences["view"]) {
    setStore((s) => {
      const mode =
        view === "timer"
          ? "countdown"
          : view === "stopwatch"
            ? "stopwatch"
            : ["focus", "short", "long"].includes(s.timer.mode)
              ? s.timer.mode
              : "focus";
      const next =
        view === "clock"
          ? s
          : transition(
              s,
              { type: "mode", mode: mode as typeof s.timer.mode },
              Date.now(),
              false,
            );
      return { ...next, preferences: { ...next.preferences, view } };
    });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="combobox"],[role="listbox"],[role="option"]',
        ) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat
      )
        return;
      if (e.key === "Escape" && !overlay) {
        setFocusView(false);
        if (document.fullscreenElement)
          void document.exitFullscreen().catch(() => {});
        return;
      }
      if (
        overlay ||
        document.querySelector("dialog[open]") ||
        target.closest("button,a")
      )
        return;
      if (e.code === "Space" && !clockView) {
        e.preventDefault();
        act({ type: "toggle" });
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFocus();
      }
      if (e.key === "?") openSettings("shortcuts");
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [overlay, clockView, act, toggleFocus, openSettings]);
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );
  const reveal = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (focusView && running && p.layout.autoHide)
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  };
  useEffect(() => {
    reveal();
  }, [focusView, running, p.layout.autoHide]);
  async function toggleBrown() {
    if (soundBusy) return;
    if (mixer.active.includes("brown")) {
      mixer.stop("brown");
      return;
    }
    setSoundBusy(true);
    try {
      await mixer.start("brown", p.mixer.levels.brown || 0.35);
    } catch {
      toast("Audio could not start. Check browser permissions.");
    } finally {
      setSoundBusy(false);
    }
  }
  const todayTime =
    store.history.reduce(
      (sum, s) => sum + timeOnDay(s.segments, new Date(now)),
      0,
    ) +
    (store.timer.countStudy
      ? timeOnDay(activeSegments(store.timer, now), new Date(now))
      : 0);
  const completed = store.history.filter(
    (s) =>
      s.completed &&
      s.mode === "focus" &&
      localDay(s.endedAt) === localDay(now),
  ).length;
  const subject = store.subjects.find((s) => s.id === store.timer.subjectId);
  const days = examDays(store.exam.date);
  const companion =
    p.layout.companionOpen && (p.layout.tasks || p.layout.notes);
  const background =
    !p.sameBackground && ["short", "long"].includes(store.timer.mode)
      ? p.breakBackground
      : p.background;
  const hasBackdrop =
    background.type !== "solid" ||
    !["midnight-library", "paper-desk"].includes(background.preset);
  const cycle = store.timer.cycle % store.settings.frequency;
  return (
    <StorageStatus.Provider
      value={{ saved, owner: ownership === "owner", error: storageError }}
    >
      {ownership !== "owner" && (
        <div className="ownership-banner" role="status">
          <span>
            {ownership === "unsupported"
              ? "Timer control needs HTTPS and a browser with Web Locks support."
              : ownership === "connecting"
                ? "Opening your room…"
                : "This tab shows your shared room. Another tab controls the timer and changes."}
          </span>
          {ownership === "viewer" && (
            <button className="primary-button" onClick={takeOver}>
              Take over in this tab
            </button>
          )}
        </div>
      )}
      <div
        inert={ownership !== "owner"}
        className={`app upgraded-room ${focusView ? "focus-view" : ""} ${!companion ? "panel-collapsed" : ""} ${hasBackdrop ? "has-backdrop" : ""} density-${p.layout.density} layout-${p.layout.position} ${!controlsVisible ? "controls-hidden" : ""}`}
        style={
          {
            "--companion-width": `${p.layout.companionWidth}px`,
          } as CSSProperties
        }
        onPointerMove={focusView ? reveal : undefined}
        onFocusCapture={reveal}
      >
        <Background config={background} lowPower={p.layout.lowPower} />
        <nav className="rail" aria-label="Main navigation">
          <a
            href="#"
            className="brand-mark"
            aria-label="Stillroom home"
            onClick={(e) => {
              e.preventDefault();
              setOverlay(null);
            }}
          >
            <BookOpen size={25} strokeWidth={1.5} />
          </a>
          <div className="rail-main">
            <button
              className={`nav-button ${!overlay ? "active" : ""}`}
              title="Study room"
              aria-label="Study room"
              onClick={() => setOverlay(null)}
            >
              <Timer size={21} />
              <span>Room</span>
            </button>
            <button
              className="nav-button"
              title="Study history"
              aria-label="Study history"
              onClick={() => setOverlay("history")}
            >
              <BarChart3 size={21} />
              <span>Journal</span>
            </button>
            <button
              className="nav-button"
              title="Study planner"
              aria-label="Study planner"
              onClick={() => setOverlay("planner")}
            >
              <CalendarDays size={21} />
              <span>Plan</span>
            </button>
            <button
              className="nav-button"
              title="Ambient sound"
              aria-label="Ambient sound"
              onClick={() => openSettings("sounds")}
            >
              <Headphones size={21} />
              <span>Sounds</span>
              {mixer.active.length > 0 && <i className="sound-indicator" />}
            </button>
            <button
              className="nav-button studio-nav"
              title="Background studio"
              aria-label="Background studio"
              onClick={() => openSettings("backgrounds")}
            >
              <Image size={21} />
              <span>Studio</span>
            </button>
          </div>
          <div className="rail-bottom">
            <IconButton
              label="Keyboard shortcuts"
              onClick={() => openSettings("shortcuts")}
            >
              <Keyboard size={20} />
            </IconButton>
            <IconButton label="Settings" onClick={() => openSettings()}>
              <Settings2 size={20} />
            </IconButton>
            <span className="rail-monogram">s.</span>
          </div>
        </nav>
        <div className="room">
          <header className="topbar">
            <a
              className="wordmark"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              stillroom
            </a>
            <div className="topbar-actions">
              <StudyExperience
                store={store}
                setStore={setStore}
                now={now}
                act={act}
                openSettings={() => openSettings()}
                openHistory={() => setOverlay("history")}
                focus={toggleFocus}
                owner={ownership === "owner"}
              />
              <button
                className="personalize-button"
                onClick={() => openSettings()}
              >
                <SlidersHorizontal size={15} />
                <span>Make it yours</span>
              </button>
              <IconButton
                label={
                  companion ? "Hide companion panel" : "Show companion panel"
                }
                onClick={() =>
                  update({
                    layout: {
                      ...p.layout,
                      companionOpen: !companion,
                      ...(!p.layout.tasks && !p.layout.notes
                        ? { tasks: true, notes: true }
                        : {}),
                    },
                  })
                }
              >
                {companion ? (
                  <PanelRightClose size={19} />
                ) : (
                  <PanelRightOpen size={19} />
                )}
              </IconButton>
            </div>
          </header>
          <main className="workspace">
            <h1 className="sr-only">Study room</h1>
            <div className="study-center">
              {p.layout.greeting && (
                <p className="personal-greeting">{p.layout.greeting}</p>
              )}
              <div
                className="room-mode-switcher"
                role="tablist"
                aria-label="Study mode"
              >
                {views.map((v) => (
                  <button
                    key={v.id}
                    role="tab"
                    aria-selected={p.view === v.id}
                    onClick={() => selectView(v.id)}
                  >
                    <v.icon size={16} />
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
              <div className="timer-workspace">
                <div className="timer-topline">
                  <div className="subject-select">
                    <span className="subject-label">Subject</span>
                    <span
                      className="subject-dot"
                      style={{
                        background: subject?.color ?? "var(--user-accent)",
                      }}
                    />
                    <Select
                      label="Active study subject"
                      value={store.timer.subjectId}
                      onChange={(id) =>
                        id === "__manage__"
                          ? openSettings("subjects")
                          : act({ type: "subject", subjectId: id })
                      }
                      options={[
                        { value: "", label: "Independent study" },
                        ...store.subjects.map((s) => ({
                          value: s.id,
                          label: s.name,
                        })),
                        { value: "__manage__", label: "Manage subjects…" },
                      ]}
                    />
                  </div>
                  <button className="focus-button" onClick={toggleFocus}>
                    {focusView ? (
                      <Minimize2 size={14} />
                    ) : (
                      <Maximize2 size={14} />
                    )}
                    <span>{focusView ? "Leave focus view" : "Focus view"}</span>
                    <kbd>F</kbd>
                  </button>
                </div>
                {p.view === "pomodoro" && (
                  <div
                    className="mode-tabs"
                    role="tablist"
                    aria-label="Pomodoro phase"
                  >
                    {(
                      [
                        { id: "focus", label: "Focus" },
                        { id: "short", label: "Short break" },
                        { id: "long", label: "Long break" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        role="tab"
                        aria-selected={store.timer.mode === m.id}
                        onClick={() => act({ type: "mode", mode: m.id })}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                {clockView && (
                  <div className="clock-zone-label">
                    <Clock3 size={13} />
                    {p.clock.timezone.replaceAll("_", " ") || "Your local time"}
                  </div>
                )}
                <TimerDisplay
                  text={digits}
                  display={
                    clockView ? { ...p.display, progress: false } : p.display
                  }
                  progress={progress}
                  running={running && !clockView}
                  caption={
                    clockView && p.clock.date
                      ? new Intl.DateTimeFormat(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          timeZone: p.clock.timezone || undefined,
                        }).format(now)
                      : ""
                  }
                />
                {clockView ? (
                  <>
                    {(running || total > 0) && (
                      <div className="compact-timer-status">
                        <span
                          className={`status-dot ${running ? "pulse" : ""}`}
                        />
                        <span>
                          {store.timer.mode === "countdown"
                            ? "Timer"
                            : store.timer.mode === "stopwatch"
                              ? "Stopwatch"
                              : "Pomodoro"}{" "}
                          {running ? "running" : "paused"} ·{" "}
                          {formatClock(
                            remaining(store.timer, now),
                            store.timer.mode === "stopwatch",
                          )}
                        </span>
                        <IconButton
                          label={
                            running
                              ? "Pause background timer"
                              : "Resume background timer"
                          }
                          onClick={() => act({ type: "toggle" })}
                        >
                          {running ? <Pause size={14} /> : <Play size={14} />}
                        </IconButton>
                        <button
                          className="text-button"
                          onClick={() =>
                            selectView(
                              store.timer.mode === "countdown"
                                ? "timer"
                                : store.timer.mode === "stopwatch"
                                  ? "stopwatch"
                                  : "pomodoro",
                            )
                          }
                        >
                          Return <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                    <p className="clock-note">
                      A moment in time. No study time is recorded by the clock.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="intention">
                      <label htmlFor="intention">Session intention</label>
                      <input
                        id="intention"
                        maxLength={500}
                        placeholder="What will you work on?"
                        value={store.timer.intention}
                        onChange={(e) =>
                          setStore((s) => ({
                            ...s,
                            timer: { ...s.timer, intention: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div id="session-next-step" />
                    <div className="timer-controls">
                      <IconButton
                        label="Reset timer (saves partial focus)"
                        onClick={() => act({ type: "reset" })}
                      >
                        <RotateCcw size={20} />
                      </IconButton>
                      <button
                        className="start-button"
                        onClick={() => act({ type: "toggle" })}
                      >
                        {running ? (
                          <Pause size={16} fill="currentColor" />
                        ) : (
                          <Play size={16} fill="currentColor" />
                        )}
                        {running ? "Pause" : total > 0 ? "Resume" : "Start"}
                        <kbd aria-hidden="true">Space</kbd>
                      </button>
                      <IconButton
                        label="Skip session (saves partial focus)"
                        onClick={() => act({ type: "skip" })}
                      >
                        <SkipForward size={20} />
                      </IconButton>
                    </div>
                    {p.view === "pomodoro" && (
                      <div className="cycle-row">
                        <div
                          role="img"
                          className={`session-tallies tallies-${p.display.tallies}`}
                          aria-label={`${cycle} of ${store.settings.frequency} sessions completed`}
                        >
                          {p.display.tallies === "numbers" ? (
                            <span>
                              {cycle} / {store.settings.frequency}
                            </span>
                          ) : (
                            Array.from(
                              { length: store.settings.frequency },
                              (_, i) => (
                                <i
                                  className={i < cycle ? "filled" : ""}
                                  key={i}
                                />
                              ),
                            )
                          )}
                        </div>
                        <span>
                          Session {cycle + 1} of {store.settings.frequency}
                        </span>
                        <span className="small-divider" />
                        <button
                          className="text-button"
                          onClick={() => openSettings("timer")}
                        >
                          Your rhythm <Settings2 size={12} />
                        </button>
                      </div>
                    )}
                    {p.view === "timer" && store.timer.mode !== "practice" && (
                      <CountdownSetup store={store} setStore={setStore} />
                    )}
                    {p.view === "stopwatch" && (
                      <LapTools store={store} act={act} />
                    )}
                  </>
                )}
                {p.layout.quotes && (
                  <p className="quiet-quote">
                    “A little attention can make an ordinary hour your own.”{" "}
                    <span>— Stillroom</span>
                  </p>
                )}
                {focusView && (
                  <button
                    className="fullscreen-button text-button"
                    onClick={() => {
                      if (document.fullscreenElement)
                        void document.exitFullscreen().catch(() => {});
                      else if (document.documentElement.requestFullscreen)
                        void document.documentElement
                          .requestFullscreen()
                          .catch(() =>
                            toast(
                              "Fullscreen is unavailable. Focus View is still active.",
                            ),
                          );
                      else
                        toast(
                          "Fullscreen is unavailable. Focus View is still active.",
                        );
                    }}
                  >
                    <Maximize2 size={14} /> Toggle browser fullscreen
                  </button>
                )}
              </div>
            </div>
            <div
              className={`room-bottom ${!p.layout.history ? "without-summary" : ""}`}
            >
              {p.layout.history && (
                <button
                  className="today-summary"
                  onClick={() => setOverlay("history")}
                >
                  <div className="summary-icon">
                    <BarChart3 size={19} />
                  </div>
                  <div>
                    <span className="eyebrow">Today</span>
                    <p>
                      <strong>{formatDuration(todayTime)}</strong> focused{" "}
                      <span>·</span> <strong>{completed}</strong>{" "}
                      {completed === 1 ? "session" : "sessions"}
                    </p>
                  </div>
                  <ArrowRight size={16} />
                </button>
              )}
              <div className="sound-card">
                <button
                  className={`sound-toggle ${mixer.active.length ? "on" : ""}`}
                  aria-label={
                    mixer.active.includes("brown")
                      ? "Stop brown noise"
                      : "Play brown noise"
                  }
                  disabled={soundBusy}
                  onClick={() => void toggleBrown()}
                >
                  <Headphones size={19} />
                </button>
                <button
                  className="sound-card-label"
                  onClick={() => openSettings("sounds")}
                >
                  <span className="eyebrow">Ambience</span>
                  <span>
                    {mixer.active.length
                      ? `${mixer.active.length} sounds playing`
                      : "Sounds off"}{" "}
                    <span className="sound-state">
                      {mixer.muted ? "Muted" : mixer.active.length ? "On" : ""}
                    </span>
                  </span>
                </button>
                <div
                  className={`sound-bars ${mixer.active.length && !mixer.muted ? "playing" : ""}`}
                  aria-hidden="true"
                >
                  {[12, 20, 28, 16, 24, 12, 20].map((h, i) => (
                    <i
                      key={i}
                      style={{ height: h, animationDelay: `${i * 0.13}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {p.layout.music && (
              <Suspense fallback={<p>Opening music panel…</p>}>
                <SpotifyPanel
                  prefs={p}
                  update={update}
                  onAdd={() => openSettings("sounds")}
                />
              </Suspense>
            )}
            <footer className="workspace-footer">
              <OfflineStatus active={running} />
              <span className="local-status">
                <ShieldCheck size={13} />
                {storageError
                  ? "In memory · saving unavailable"
                  : saved
                    ? "Saved in this browser"
                    : "In memory"}
              </span>
              {p.layout.date && (
                <time className="room-date">
                  {new Date(now).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {new Date(now).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              )}
              {p.layout.exam && days !== null ? (
                <button
                  className="text-button"
                  onClick={() => setOverlay("planner")}
                >
                  <CalendarDays size={13} />
                  {store.exam.name || "Your milestone"} ·{" "}
                  {days > 0
                    ? `${days} days to go`
                    : days === 0
                      ? "Today"
                      : `${Math.abs(days)} days ago`}
                </button>
              ) : (
                <button
                  className="text-button"
                  onClick={() => openSettings("shortcuts")}
                >
                  A few useful shortcuts <Keyboard size={14} />
                </button>
              )}
            </footer>
          </main>
        </div>
        {companion && (
          <button
            className="companion-scrim"
            aria-label="Close companion panel"
            onClick={() =>
              update({ layout: { ...p.layout, companionOpen: false } })
            }
          />
        )}
        {companion && (
          <Companion
            store={store}
            setStore={setStore}
            toast={toast}
            onClose={() =>
              update({ layout: { ...p.layout, companionOpen: false } })
            }
          />
        )}
        <Suspense
          fallback={
            <div className="panel-loading-overlay">Opening your room…</div>
          }
        >
          {overlay === "settings" && (
            <Settings
              store={store}
              setStore={setStore}
              onClose={() => setOverlay(null)}
              toast={toast}
              initialTab={section}
            />
          )}{" "}
          {overlay === "history" && (
            <History
              store={store}
              setStore={setStore}
              onClose={() => setOverlay(null)}
            />
          )}{" "}
          {overlay === "planner" && (
            <Planner
              store={store}
              setStore={setStore}
              onClose={() => setOverlay(null)}
            />
          )}
        </Suspense>
        {createPortal(
          <div className="feedback-stack" id="room-feedback">
            {alarms.active && !overlay && (
              <div className="alarm-banner" role="status">
                <Bell size={18} />
                <span>A session has come to a close.</span>
                <button
                  className="primary-button"
                  onClick={() => alarms.stop()}
                >
                  <Square size={13} /> Dismiss alarm
                </button>
              </div>
            )}
            {storageError && (
              <div className="storage-warning" role="alert">
                {storageError}
                <button
                  className="text-button"
                  onClick={() => openSettings("data")}
                >
                  Open data settings
                </button>
              </div>
            )}
            {notification && !overlay && (
              <div className="toast" role="status">
                <Check size={16} />
                <span>{notification.message}</span>
                {notification.undo && (
                  <button
                    className="text-button"
                    onClick={() => {
                      notification.undo?.();
                      setNotification(null);
                    }}
                  >
                    Undo
                  </button>
                )}
                <IconButton
                  label="Dismiss message"
                  onClick={() => setNotification(null)}
                >
                  <X size={15} />
                </IconButton>
              </div>
            )}
          </div>,
          document.body,
        )}
      </div>
    </StorageStatus.Provider>
  );
}
