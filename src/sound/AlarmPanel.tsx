import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, Play, Square, Upload, Trash2 } from "lucide-react";
import type { Preferences, AlarmId } from "../preferences";
import type { Store } from "../types";
import type { SetStore } from "../components/Companion";
import { alarms, alarmChoices } from "./alarms";
import { saveMedia, getMedia, removeMedia } from "../media";
import { Select } from "../components/Select";
import { Section, Slider, Toggle } from "../components/Controls";
export default function AlarmPanel({
  store,
  setStore,
  update,
}: {
  store: Store;
  setStore: SetStore;
  update: (patch: Partial<Preferences>) => void;
}) {
  useSyncExternalStore(alarms.subscribe, alarms.getSnapshot);
  const a = store.preferences.alarms;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filename, setFilename] = useState(""),
    [permission, setPermission] = useState(
      "Notification" in window ? Notification.permission : "unsupported",
    );
  useEffect(() => {
    if (a.mediaId)
      void getMedia(a.mediaId)
        .then((m) => setFilename(m?.name ?? "Missing on this device"))
        .catch(() => setFilename("Unavailable"));
    else setFilename("");
  }, [a.mediaId]);
  const change = (patch: Partial<typeof a>) =>
    update({ alarms: { ...a, ...patch } });
  async function preview(id: AlarmId) {
    try {
      await alarms.play(id, a, true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Section
        title="A gentle way to return"
        description="Distinct, original synthesized alarms. Alert volume stays separate from the room's ambience."
      >
        <div className="alarm-select-row">
          <label>
            Focus & countdown completion
            <Select
              label="Focus completion alarm"
              value={a.focus}
              onChange={(focus) => change({ focus: focus as AlarmId })}
              options={alarmChoices}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => void preview(a.focus)}
          >
            <Play size={14} /> Preview focus alarm
          </button>
        </div>
        <div className="alarm-select-row">
          <label>
            Break completion
            <Select
              label="Break completion alarm"
              value={a.break}
              onChange={(v) => change({ break: v as AlarmId })}
              options={alarmChoices}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => void preview(a.break)}
          >
            <Play size={14} /> Preview break alarm
          </button>
        </div>
        <Slider
          label="Alarm volume"
          value={a.volume}
          onChange={(volume) => change({ volume })}
        />
        <Toggle
          label="Completion sounds"
          checked={store.settings.sound}
          onChange={(sound) =>
            setStore((s) => ({ ...s, settings: { ...s.settings, sound } }))
          }
        />
        <Toggle
          label="Gradual alarm fade-in"
          checked={a.fade}
          onChange={(fade) => change({ fade })}
        />
        <Select
          label="Alarm repetition"
          value={String(a.repeat)}
          onChange={(v) => change({ repeat: Number(v) })}
          options={[
            { value: "1", label: "Play once" },
            ...Array.from({ length: 4 }, (_, i) => ({
              value: String(i + 2),
              label: `Repeat ${i + 2} times`,
            })),
          ]}
        />
        <p className="field-hint">
          Repeats are bounded to five. Preview plays once. Old completions
          recovered after an absence are shown without sounding an alarm.
        </p>
        {alarms.active && (
          <button className="primary-button" onClick={() => alarms.stop()}>
            <Square size={14} /> Dismiss alarm
          </button>
        )}
      </Section>
      <Section
        title="A familiar sound"
        description="Upload MP3, WAV, OGG, M4A or WebM audio. Maximum 10 MB and 30 seconds. It stays in local media storage."
      >
        <label className="upload-inline">
          <Upload size={16} />
          {busy ? "Checking audio…" : "Upload custom alarm"}
          <input
            type="file"
            aria-label="Upload custom alarm"
            disabled={busy}
            accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                const asset = await saveMedia(file, "alarm");
                change({ mediaId: asset.id, focus: "custom" });
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {filename && (
          <div className="button-row">
            <span className="field-hint">{filename}</span>
            <button
              className="text-button"
              onClick={() => {
                alarms.stop();
                void removeMedia(a.mediaId)
                  .then(() =>
                    change({
                      mediaId: "",
                      focus: a.focus === "custom" ? "chime" : a.focus,
                      break: a.break === "custom" ? "bell" : a.break,
                    }),
                  )
                  .catch((e) => setError(e.message));
              }}
            >
              <Trash2 size={14} /> Remove custom audio
            </button>
          </div>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </Section>
      <Section
        title="A note from your room"
        description="Notifications require permission and depend on your browser. No alarms can run while the page is closed."
      >
        <div className="permission-status">
          <Bell size={17} />
          <span>
            Browser permission: <strong>{permission}</strong>
          </span>
        </div>
        <Toggle
          label="Browser notifications"
          checked={store.settings.notifications}
          onChange={async (enabled) => {
            if (!enabled) {
              setStore((s) => ({
                ...s,
                settings: { ...s.settings, notifications: false },
              }));
              return;
            }
            if (!("Notification" in window)) {
              setError("Notifications are not supported here.");
              return;
            }
            try {
              const result = await Notification.requestPermission();
              setPermission(result);
              if (result === "granted")
                setStore((s) => ({
                  ...s,
                  settings: { ...s.settings, notifications: true },
                }));
              else
                setError(
                  "Allow notifications in your browser’s site settings to enable them.",
                );
            } catch {
              setError("Notifications are unavailable in this browser.");
            }
          }}
        />
      </Section>
    </>
  );
}
