import { StorageStatus } from "./StorageStatus";
import {
  useEffect,
  useContext,
  lazy,
  Suspense,
  useMemo,
  useState,
} from "react";
import {
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Headphones,
  Image,
  Keyboard,
  LayoutPanelLeft,
  Palette,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Timer,
  Type,
  X,
} from "lucide-react";
import type { Store, Theme } from "../types";
import type { SetStore } from "./Companion";
import { defaultPreferences, type Preferences } from "../preferences";
import { defaults, transition } from "../timer";
import { backgrounds } from "../backgrounds/catalog";
import { builtinRooms, captureRoom, applyRoom } from "../roomPresets";
import { mixer } from "../sound/mixer";
import { alarms } from "../sound/alarms";
import { Select } from "./Select";
import { Modal } from "./UI";
import { ColorField, Section, Slider, Toggle } from "./Controls";
import { TimerDisplay } from "../display/TimerDisplay";
import { SubjectsPanel } from "./SubjectsPanel";
import { DataPanel } from "./DataPanel";
import { SpotifySettings } from "./SpotifyPanel";
const BackgroundStudio = lazy(() => import("../backgrounds/BackgroundStudio"));
const MixerPanel = lazy(() => import("../sound/MixerPanel"));
const AlarmPanel = lazy(() => import("../sound/AlarmPanel"));
export const settingsCategories = [
  { id: "room", label: "Appearance", icon: Palette },
  { id: "backgrounds", label: "Backgrounds", icon: Image },
  { id: "timer", label: "Timer & Cycles", icon: Timer },
  { id: "clock", label: "Clock & Typography", icon: Type },
  { id: "sounds", label: "Sounds & Music", icon: Headphones },
  { id: "alarms", label: "Alarms & Notifications", icon: Bell },
  { id: "layout", label: "Layout & Focus View", icon: LayoutPanelLeft },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "data", label: "Data & Privacy", icon: ShieldCheck },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
];
export default function Settings({
  store,
  setStore,
  onClose,
  toast,
  initialTab = "room",
}: {
  store: Store;
  setStore: SetStore;
  onClose: () => void;
  toast: (message: string) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab),
    [search, setSearch] = useState(""),
    [resetting, setResetting] = useState(false);
  const storage = useContext(StorageStatus);
  const prefs = store.preferences;
  const update = (patch: Partial<Preferences>) =>
    setStore((s) => ({ ...s, preferences: { ...s.preferences, ...patch } }));
  function resetSection() {
    const d = defaultPreferences();
    if (tab === "room") {
      update({ display: d.display });
      setStore((s) => ({
        ...s,
        settings: { ...s.settings, theme: "midnight" },
      }));
    } else if (tab === "backgrounds")
      update({
        background: d.background,
        breakBackground: d.breakBackground,
        sameBackground: true,
      });
    else if (tab === "timer") {
      update({ cycles: d.cycles });
      setStore((s) => ({
        ...s,
        settings: {
          ...s.settings,
          focus: 25,
          short: 5,
          long: 15,
          frequency: 4,
          autoStart: false,
          countdown: 1500,
          countStudy: true,
        },
      }));
    } else if (tab === "clock") update({ clock: d.clock, display: d.display });
    else if (tab === "sounds") {
      mixer.stopAll();
      update({
        mixer: { ...d.mixer, presets: prefs.mixer.presets },
        spotify: { ...prefs.spotify, enabled: false },
      });
    } else if (tab === "alarms") {
      alarms.stop();
      update({ alarms: d.alarms });
      setStore((s) => ({
        ...s,
        settings: { ...s.settings, sound: true, notifications: false },
      }));
    } else if (tab === "layout") update({ layout: d.layout });
    toast(
      "Section preferences reset. Your timer and study data are unchanged.",
    );
  }
  const category = settingsCategories.find((c) => c.id === tab)!;
  return (
    <Modal
      className="settings-dialog"
      title="Make yourself at home."
      subtitle="A room for the way you work."
      onClose={onClose}
      wide
    >
      {storage.error && (
        <p className="error-message" role="alert">
          {storage.error}
        </p>
      )}
      {alarms.active && tab !== "alarms" && (
        <button className="secondary-button" onClick={() => alarms.stop()}>
          Dismiss alarm
        </button>
      )}
      <div className="settings-shell">
        <aside className="settings-sidebar">
          <label className="settings-search">
            <Search size={15} />
            <input
              aria-label="Search settings"
              placeholder="Find a setting…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                aria-label="Clear settings search"
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </label>
          <nav role="tablist" aria-label="Settings categories">
            {settingsCategories
              .filter((c) =>
                c.label.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={tab === c.id}
                  onClick={() => setTab(c.id)}
                >
                  <c.icon size={17} />
                  <span>{c.label}</span>
                  <ChevronRight size={12} />
                </button>
              ))}
          </nav>
          <div className="settings-sidebar-footer">
            <span className="status-dot" />{" "}
            {storage.saved ? "Changes saved locally" : "Changes in memory"}
            <span>Your timer keeps its rhythm.</span>
          </div>
        </aside>
        <div
          className="settings-content"
          role="tabpanel"
          aria-label={category.label}
          key={tab}
        >
          <div className="settings-section-title">
            <span className="eyebrow">
              YOUR ROOM / {category.label.toUpperCase()}
            </span>
            <span className="live-badge">
              <span className="status-dot" /> Live preview
            </span>
          </div>
          <Suspense
            fallback={
              <p className="panel-loading">Opening your room studio…</p>
            }
          >
            {tab === "room" && (
              <Appearance store={store} setStore={setStore} update={update} />
            )}
            {tab === "backgrounds" && (
              <BackgroundStudio prefs={prefs} update={update} />
            )}
            {tab === "timer" && (
              <Cycles store={store} setStore={setStore} update={update} />
            )}
            {tab === "clock" && (
              <ClockTypography prefs={prefs} update={update} />
            )}
            {tab === "sounds" && (
              <>
                <MixerPanel prefs={prefs} update={update} />
                <SpotifySettings prefs={prefs} update={update} />
              </>
            )}
            {tab === "alarms" && (
              <AlarmPanel store={store} setStore={setStore} update={update} />
            )}
            {tab === "layout" && <Layout prefs={prefs} update={update} />}
            {tab === "subjects" && (
              <SubjectsPanel store={store} setStore={setStore} />
            )}
            {tab === "data" && (
              <DataPanel
                store={store}
                setStore={setStore}
                onClose={onClose}
                toast={toast}
              />
            )}
            {tab === "shortcuts" && <Shortcuts />}
          </Suspense>
          {!["subjects", "data", "shortcuts"].includes(tab) && (
            <div className="section-reset">
              <button className="text-button" onClick={resetSection}>
                <RotateCcw size={13} /> Reset this section
              </button>
              <p>Only these preferences. No timer reset or history changes.</p>
            </div>
          )}
          {tab === "data" && (
            <Section
              title="Reset the room, keep the work"
              description="Restore all preferences and future timer defaults. Keep your active timer, subjects, tasks, notes, history, saved media, and study plan."
            >
              {resetting ? (
                <div className="confirmation">
                  <p>
                    Your saved room and mixer presets will also be removed.
                    Playback will stop.
                  </p>
                  <div className="dialog-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setResetting(false)}
                    >
                      Keep preferences
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => {
                        mixer.stopAll();
                        alarms.stop();
                        setStore((s) => ({
                          ...s,
                          settings: { ...defaults },
                          preferences: defaultPreferences(),
                        }));
                        setResetting(false);
                        toast(
                          "Preferences reset. Study data and the active timer were kept.",
                        );
                      }}
                    >
                      Reset all preferences
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => setResetting(true)}
                >
                  Reset all preferences
                </button>
              )}
            </Section>
          )}
        </div>
      </div>
    </Modal>
  );
}
function Appearance({
  store,
  setStore,
  update,
}: {
  store: Store;
  setStore: SetStore;
  update: (patch: Partial<Preferences>) => void;
}) {
  const p = store.preferences;
  const [name, setName] = useState(""),
    [selected, setSelected] = useState("");
  const themes = [
    {
      id: "midnight",
      name: "Midnight Library",
      colors: ["#1c1d19", "#eeece2", "#c7aa76"],
    },
    {
      id: "paper",
      name: "Paper Desk",
      colors: ["#f3f0e7", "#29352c", "#47644b"],
    },
    {
      id: "rain",
      name: "Rain Window",
      colors: ["#202931", "#e4eaf0", "#a2bdce"],
    },
  ];
  return (
    <>
      <Section
        title="A familiar feeling. Entirely yours."
        description="Choose the room's palette, then make the details your own."
      >
        <div className="theme-options">
          {themes.map((t) => (
            <button
              key={t.id}
              aria-pressed={store.settings.theme === t.id}
              className={`theme-option ${store.settings.theme === t.id ? "chosen" : ""}`}
              onClick={() =>
                setStore((s) => ({
                  ...s,
                  settings: { ...s.settings, theme: t.id as Theme },
                  preferences: {
                    ...s.preferences,
                    background: [
                      "midnight-library",
                      "paper-desk",
                      "rain-window",
                    ].includes(s.preferences.background.preset)
                      ? {
                          ...backgrounds.find(
                            (b) =>
                              b.id ===
                              (t.id === "paper"
                                ? "paper-desk"
                                : t.id === "rain"
                                  ? "rain-window"
                                  : "midnight-library"),
                          )!.config,
                        }
                      : s.preferences.background,
                  },
                }))
              }
            >
              <span
                className="theme-swatch"
                style={{ background: t.colors[0], color: t.colors[1] }}
              >
                <span>Aa</span>
                <i style={{ background: t.colors[2] }} />
              </span>
              <span className="theme-name">
                {t.name}
                {store.settings.theme === t.id && <Check size={14} />}
              </span>
            </button>
          ))}
        </div>
      </Section>
      <Section
        title="How time looks"
        description="Six views of the same trustworthy timer. Changing the display never changes time."
      >
        <div className="display-style-grid">
          {[
            { id: "digital", name: "Clean digital", sample: "25:00" },
            { id: "serif", name: "Editorial serif", sample: "25:00" },
            { id: "flip", name: "Flip clock", sample: "25:00" },
            { id: "ring", name: "Progress ring", sample: "◯" },
            { id: "bar", name: "Minimal bar", sample: "━━━" },
            { id: "matrix", name: "Dot matrix", sample: "25:00" },
          ].map((style) => (
            <button
              key={style.id}
              className={`style-card style-card-${style.id} ${p.display.style === style.id ? "selected" : ""}`}
              aria-pressed={p.display.style === style.id}
              onClick={() =>
                update({
                  display: {
                    ...p.display,
                    style: style.id as typeof p.display.style,
                  },
                })
              }
            >
              <span>{style.sample}</span>
              <strong>{style.name}</strong>
            </button>
          ))}
        </div>
        <div className="live-display-preview">
          <TimerDisplay
            text="25:00"
            display={p.display}
            progress={0.38}
            preview
            caption="A little room for your next chapter."
          />
        </div>
      </Section>
      <Section
        title="Rooms to return to"
        description="Save appearance, background, display, layout, and mixer levels together. Your timer, subject, and study history are never included."
      >
        <Select
          label="Saved room presets"
          value={selected}
          onChange={(id) => {
            setSelected(id);
            const room = [...builtinRooms, ...p.rooms].find((r) => r.id === id);
            if (room) {
              mixer.stopAll();
              setStore((s) => applyRoom(s, room));
            }
          }}
          options={[
            { value: "", label: "Choose a room" },
            ...builtinRooms.map((r) => ({ value: r.id, label: r.name })),
            ...p.rooms.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              update({ rooms: [...p.rooms, captureRoom(store, name.trim())] });
              setName("");
            }
          }}
        >
          <input
            aria-label="Room preset name"
            value={name}
            placeholder="Name this room…"
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="secondary-button"
            disabled={!name.trim() || p.rooms.length >= 30}
          >
            <Save size={14} /> Save room
          </button>
        </form>
        {p.rooms.some((r) => r.id === selected) && (
          <button
            className="text-button"
            onClick={() => {
              update({ rooms: p.rooms.filter((r) => r.id !== selected) });
              setSelected("");
            }}
          >
            Delete this saved room
          </button>
        )}
      </Section>
    </>
  );
}
function Cycles({
  store,
  setStore,
  update,
}: {
  store: Store;
  setStore: SetStore;
  update: (patch: Partial<Preferences>) => void;
}) {
  const [draft, setDraft] = useState(store.settings),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [preset, setPreset] = useState("custom");
  useEffect(() => setDraft(store.settings), [store.settings]);
  return (
    <Section
      title="Find your rhythm"
      description="Duration changes apply to future sessions. The timer currently on your desk keeps its original deadline."
    >
      <Select
        label="Pomodoro preset"
        value={preset}
        onChange={(v) => {
          setPreset(v);
          const times =
            v === "classic"
              ? [25, 5, 15]
              : v === "deep"
                ? [50, 10, 20]
                : [52, 17, 30];
          if (v !== "custom")
            setDraft({
              ...draft,
              focus: times[0],
              short: times[1],
              long: times[2],
            });
        }}
        options={[
          { value: "custom", label: "Custom rhythm" },
          { value: "classic", label: "Classic · 25 / 5" },
          { value: "deep", label: "Deep Work · 50 / 10" },
          { value: "52", label: "52 / 17" },
        ]}
      />
      <form
        className="form-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (
            ![draft.focus, draft.short, draft.long].every(
              (v) => Number.isFinite(v) && v >= 1 && v <= 180,
            ) ||
            !Number.isInteger(draft.frequency) ||
            draft.frequency < 1 ||
            draft.frequency > 12
          ) {
            setError(
              "Durations must be 1–180 minutes; frequency must be a whole number from 1–12.",
            );
            return;
          }
          setStore((s) => ({
            ...s,
            settings: {
              ...s.settings,
              focus: draft.focus,
              short: draft.short,
              long: draft.long,
              frequency: draft.frequency,
            },
          }));
          setError("");
          setMessage(
            "Saved for future sessions. The current timer is unchanged.",
          );
        }}
      >
        <div className="form-grid three">
          {(["focus", "short", "long"] as const).map((k) => (
            <label key={k}>
              {k === "focus"
                ? "Focus"
                : k === "short"
                  ? "Short break"
                  : "Long break"}
              <input
                type="number"
                min={1}
                max={180}
                step={0.5}
                aria-label={`${k === "focus" ? "Focus" : k === "short" ? "Short break" : "Long break"} duration in minutes`}
                value={Number.isNaN(draft[k]) ? "" : draft[k]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [k]: e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
              <span>minutes</span>
            </label>
          ))}
        </div>
        <label>
          Long break after
          <input
            className="short-input"
            type="number"
            min={1}
            max={12}
            step={1}
            value={Number.isNaN(draft.frequency) ? "" : draft.frequency}
            onChange={(e) =>
              setDraft({
                ...draft,
                frequency: e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
          <span>completed Pomodoro focus sessions</span>
        </label>
        <button className="primary-button fit">Save timer settings</button>
      </form>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      <div className="apply-current">
        <button
          className="secondary-button"
          onClick={() => {
            if (
              (store.timer.runningSince !== null || store.timer.elapsed > 0) &&
              !confirm(
                "Apply saved duration to this timer? Partial study time is saved, and the timer resets paused.",
              )
            )
              return;
            setStore((s) =>
              transition(s, { type: "apply-duration" }, Date.now(), false),
            );
            setMessage("Saved duration applied. The timer is paused.");
          }}
        >
          Apply saved duration to current timer
        </button>
        <p className="field-hint">
          Explicitly resets the current timer, saving any partial work.
        </p>
      </div>
      <Toggle
        label="Auto-start breaks"
        checked={store.preferences.cycles.autoBreak}
        onChange={(autoBreak) => {
          update({ cycles: { ...store.preferences.cycles, autoBreak } });
          setStore((s) => ({
            ...s,
            settings: { ...s.settings, autoStart: false },
          }));
        }}
        description="Start the break after a completed focus session."
      />
      <Toggle
        label="Auto-start focus"
        checked={store.preferences.cycles.autoFocus}
        onChange={(autoFocus) => {
          update({ cycles: { ...store.preferences.cycles, autoFocus } });
          setStore((s) => ({
            ...s,
            settings: { ...s.settings, autoStart: false },
          }));
        }}
        description="Start a new focus session after a break."
      />
      <p className="field-hint">
        Automatic transitions only occur while the room is visible and near the
        actual deadline. After an absence, the next session waits for you.
      </p>
    </Section>
  );
}
function ClockTypography({
  prefs: p,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const [search, setSearch] = useState("");
  const zones = useMemo(() => {
    try {
      return (
        Intl as unknown as { supportedValuesOf: (key: string) => string[] }
      ).supportedValuesOf("timeZone");
    } catch {
      return [
        "UTC",
        "Asia/Kathmandu",
        "Asia/Kolkata",
        "Asia/Tokyo",
        "Europe/London",
        "Europe/Paris",
        "America/New_York",
        "America/Los_Angeles",
        "Australia/Sydney",
      ];
    }
  }, []);
  const change = (patch: Partial<typeof p.display>) =>
    update({ display: { ...p.display, ...patch } });
  return (
    <>
      <Section
        title="Type with a little character"
        description="Bundled fonts, stable numerals, and room to breathe."
      >
        <div className="form-grid">
          <label className="studio-label">
            Timer font
            <Select
              label="Timer font"
              value={p.display.font}
              onChange={(font) =>
                change({ font: font as typeof p.display.font })
              }
              options={[
                { value: "sans", label: "DM Sans · clean" },
                { value: "serif", label: "Cormorant · editorial" },
                { value: "mono", label: "IBM Plex Mono · precise" },
              ]}
            />
          </label>
          <label className="studio-label">
            Weight
            <Select
              label="Timer font weight"
              value={p.display.weight}
              onChange={(weight) =>
                change({ weight: weight as typeof p.display.weight })
              }
              options={[
                { value: "400", label: "Regular" },
                { value: "500", label: "Medium" },
                { value: "600", label: "Semibold" },
              ]}
            />
          </label>
        </div>
        <Slider
          label="Timer size"
          value={p.display.size}
          min={60}
          max={130}
          step={5}
          onChange={(size) => change({ size })}
        />
        <div className="form-grid">
          <ColorField
            label="Digit color"
            value={
              p.display.digitColor ||
              (document.documentElement.dataset.theme === "paper"
                ? "#29352c"
                : "#eeece2")
            }
            onChange={(digitColor) => change({ digitColor })}
          />
          <ColorField
            label="Accent color"
            value={
              p.display.accent ||
              (document.documentElement.dataset.theme === "paper"
                ? "#47644b"
                : "#c7aa76")
            }
            onChange={(accent) => change({ accent })}
          />
        </div>
        <button
          className="text-button"
          onClick={() => change({ digitColor: "", accent: "" })}
        >
          Use theme colors
        </button>
        <Toggle
          label="Show timer seconds"
          checked={p.display.seconds}
          onChange={(seconds) => change({ seconds })}
        />
        <Toggle
          label="Show progress indicator"
          checked={p.display.progress}
          onChange={(progress) => change({ progress })}
        />
        <Select
          label="Session tally style"
          value={p.display.tallies}
          onChange={(tallies) =>
            change({ tallies: tallies as typeof p.display.tallies })
          }
          options={[
            { value: "dots", label: "Quiet dots" },
            { value: "bars", label: "Small bars" },
            { value: "numbers", label: "Session numbers" },
          ]}
        />
        <div className="live-display-preview">
          <TimerDisplay
            text={p.display.seconds ? "25:00" : "25"}
            display={p.display}
            progress={0.45}
            preview
          />
        </div>
      </Section>
      <Section
        title="Time, where you are"
        description="The wall clock is a display only. Study history always uses your device's local timezone."
      >
        <Toggle
          label="12-hour clock"
          checked={p.clock.hour12}
          onChange={(hour12) => update({ clock: { ...p.clock, hour12 } })}
        />
        <Toggle
          label="Clock seconds"
          checked={p.clock.seconds}
          onChange={(seconds) => update({ clock: { ...p.clock, seconds } })}
        />
        <Toggle
          label="Clock date"
          checked={p.clock.date}
          onChange={(date) => update({ clock: { ...p.clock, date } })}
        />
        <label className="studio-label">
          Find a timezone
          <input
            aria-label="Search timezones"
            placeholder="City or region…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Select
          label="Clock timezone"
          value={p.clock.timezone}
          onChange={(timezone) => update({ clock: { ...p.clock, timezone } })}
          options={[
            { value: "", label: "Local device timezone" },
            ...Array.from(
              new Set([
                p.clock.timezone,
                ...zones.filter((z) =>
                  z
                    .toLowerCase()
                    .replaceAll("_", " ")
                    .includes(search.toLowerCase()),
                ),
              ]),
            )
              .filter(Boolean)
              .map((value) => ({ value, label: value.replaceAll("_", " ") })),
          ]}
        />
      </Section>
    </>
  );
}
function Layout({
  prefs: p,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const change = (patch: Partial<typeof p.layout>) =>
    update({ layout: { ...p.layout, ...patch } });
  return (
    <>
      <Section
        title="Just what you need"
        description="Choose what belongs on your desk. Hidden tools keep their data."
      >
        {(
          [
            ["tasks", "Task list"],
            ["notes", "Scratchpad"],
            ["history", "Today’s history summary"],
            ["exam", "Exam countdown"],
            ["date", "Clock and date"],
            ["music", "Music panel"],
          ] as const
        ).map(([key, label]) => (
          <Toggle
            label={label}
            key={key}
            checked={p.layout[key]}
            onChange={(value) => change({ [key]: value })}
          />
        ))}
        <div className="form-grid">
          <Select
            label="Timer layout"
            value={p.layout.position}
            onChange={(position) =>
              change({ position: position as typeof p.layout.position })
            }
            options={[
              { value: "workspace", label: "Workspace · tools nearby" },
              { value: "centered", label: "Centered · room to breathe" },
            ]}
          />
          <Select
            label="Room density"
            value={p.layout.density}
            onChange={(density) =>
              change({ density: density as typeof p.layout.density })
            }
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </div>
        <Slider
          label="Companion width"
          value={p.layout.companionWidth}
          min={260}
          max={440}
          step={10}
          unit="px"
          onChange={(companionWidth) => change({ companionWidth })}
        />
        <Toggle
          label="Auto-hide controls during focus"
          checked={p.layout.autoHide}
          onChange={(autoHide) => change({ autoHide })}
          description="In Focus View, move the pointer or focus a control to reveal it."
        />
        <Toggle
          label="Low-performance mode"
          checked={p.layout.lowPower}
          onChange={(lowPower) => change({ lowPower })}
          description="Pause visual animation and use still frames for moving backgrounds."
        />
      </Section>
      <Section title="A small personal touch">
        <label className="studio-label">
          Personal greeting
          <input
            aria-label="Personal greeting"
            placeholder="Make room for focus."
            maxLength={100}
            value={p.layout.greeting}
            onChange={(e) => change({ greeting: e.target.value })}
          />
        </label>
        <Toggle
          label="Show a quiet quote"
          checked={p.layout.quotes}
          onChange={(quotes) => change({ quotes })}
          description="Off by default. An original note appears beneath the timer."
        />
      </Section>
    </>
  );
}
export function Shortcuts() {
  return (
    <Section
      title="A few quiet shortcuts."
      description="Shortcuts stay out of the way when you're typing, choosing an option, or using a dialog."
    >
      <div className="shortcut-list">
        {[
          ["Start or pause the active timer", "Space"],
          ["Toggle Focus View", "F"],
          ["Open command palette", "Alt K"],
          ["Close a dialog or leave Focus View", "Esc"],
          ["Open this reference", "?"],
          ["Navigate a dropdown", "↑ ↓"],
          ["Choose an option", "Enter"],
        ].map(([label, key]) => (
          <div key={label}>
            <span>{label}</span>
            <kbd>{key}</kbd>
          </div>
        ))}
      </div>
      <p className="field-hint">
        Dropdowns support arrow keys, typeahead, Home, End, Enter, and Escape.
        Use Tab to move between controls. Clock View does not start a study
        session.
      </p>
    </Section>
  );
}
