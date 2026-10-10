import { useState } from "react";
import { Flag, Check } from "lucide-react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { formatClock, transition, type TimerAction } from "../timer";
import { Toggle } from "./Controls";
export function CountdownSetup({
  store,
  setStore,
}: {
  store: Store;
  setStore: SetStore;
}) {
  const [duration, setDuration] = useState(() => ({
    hours: Math.floor(store.settings.countdown / 3600),
    minutes: Math.floor((store.settings.countdown % 3600) / 60),
    seconds: store.settings.countdown % 60,
  }));
  const [error, setError] = useState("");
  const active = store.timer.runningSince !== null || store.timer.elapsed > 0;
  function apply(seconds: number) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400) {
      setError("Choose a duration between 1 second and 24 hours.");
      return;
    }
    setStore((s) => {
      const updated = { ...s, settings: { ...s.settings, countdown: seconds } };
      return transition(updated, { type: "apply-duration" }, Date.now(), false);
    });
    setError("");
  }
  return (
    <div className="countdown-setup">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(
            duration.hours * 3600 + duration.minutes * 60 + duration.seconds,
          );
        }}
      >
        <div className="duration-inputs">
          {(["hours", "minutes", "seconds"] as const).map((key, i) => (
            <label key={key}>
              <input
                aria-label={`Countdown ${key}`}
                type="number"
                min="0"
                max={i === 0 ? 24 : 59}
                step="1"
                required
                value={Number.isNaN(duration[key]) ? "" : duration[key]}
                onChange={(e) =>
                  setDuration({
                    ...duration,
                    [key]: e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
              <span>{key}</span>
            </label>
          ))}
          <button
            className="secondary-button"
            title={
              active ? "Save partial work and apply duration" : "Apply duration"
            }
          >
            <Check size={15} />
            <span>{active ? "Apply & reset" : "Set timer"}</span>
          </button>
        </div>
      </form>
      <div className="quick-presets">
        {[15, 25, 45, 60, 120].map((minutes) => (
          <button
            key={minutes}
            onClick={() => {
              setDuration({
                hours: Math.floor(minutes / 60),
                minutes: minutes % 60,
                seconds: 0,
              });
              apply(minutes * 60);
            }}
          >
            {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
          </button>
        ))}
      </div>
      <Toggle
        label="Count as study time"
        description={
          active
            ? "Applies after reset. Current session keeps its original choice."
            : undefined
        }
        checked={store.settings.countStudy}
        onChange={(countStudy) =>
          setStore((s) => ({
            ...s,
            settings: { ...s.settings, countStudy },
            timer: !active ? { ...s.timer, countStudy } : s.timer,
          }))
        }
      />
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="field-hint">
        Independent of your Pomodoro cycle. Applying a duration saves any
        partial work.
      </p>
    </div>
  );
}
export function LapTools({
  store,
  act,
}: {
  store: Store;
  act: (action: TimerAction) => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <div className="lap-tools">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          act({ type: "lap", label });
          setLabel("");
        }}
      >
        <input
          aria-label="Lap label"
          value={label}
          maxLength={100}
          placeholder="Optional lap label…"
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          className="secondary-button"
          disabled={
            store.timer.runningSince === null || store.timer.laps.length >= 200
          }
        >
          <Flag size={14} /> Mark lap
        </button>
      </form>
      {store.timer.laps.length > 0 && (
        <ol className="lap-list">
          {[...store.timer.laps].reverse().map((lap, index) => (
            <li key={lap.id}>
              <span>
                {lap.label || `Lap ${store.timer.laps.length - index}`}
              </span>
              <time>{formatClock(lap.elapsed, true)}</time>
            </li>
          ))}
        </ol>
      )}
      <p className="field-hint">
        Laps mark moments within this session. They never add duplicate study
        time.
      </p>
    </div>
  );
}
