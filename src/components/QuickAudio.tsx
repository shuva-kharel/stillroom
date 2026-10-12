import { useState, useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { mixer } from "../sound/mixer";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import { Modal } from "./UI";
import { Slider, Toggle } from "./Controls";

export function QuickAudio({
  store,
  setStore,
  customize,
}: {
  store: Store;
  setStore: SetStore;
  customize: () => void;
}) {
  useSyncExternalStore(mixer.subscribe, mixer.getSnapshot);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="sound-card-label quick-ambience"
        aria-label="Quick ambience controls"
        onClick={() => setOpen(true)}
      >
        <Volume2 className="quick-ambience-icon" size={18} aria-hidden="true" />
        <span className="eyebrow">Ambience</span>
        <span>
          {mixer.muted
            ? "Muted"
            : mixer.active.length
              ? `${mixer.active.length} sounds playing`
              : "Sounds off"}
        </span>
      </button>
      {open && (
        <Modal title="Ambience" onClose={() => setOpen(false)}>
          <div className="form-stack">
            <Slider
              label="Ambience volume"
              min={0}
              max={1}
              step={0.01}
              value={store.preferences.mixer.master}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(master) =>
                setStore((s) => ({
                  ...s,
                  preferences: {
                    ...s.preferences,
                    mixer: { ...s.preferences.mixer, master },
                  },
                }))
              }
            />
            <Toggle
              label="Mute ambience"
              checked={mixer.muted}
              onChange={(value) => mixer.mute(value)}
            />
            <p className="field-hint">
              Alarm and Spotify volume are separate. Your timer keeps running.
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                setOpen(false);
                customize();
              }}
            >
              Customize sounds & presets
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
