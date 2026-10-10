import { useState, useSyncExternalStore } from "react";
import {
  AudioLines,
  CloudLightning,
  CloudRain,
  Coffee,
  Fan,
  Flame,
  Headphones,
  Keyboard,
  Pause,
  Play,
  Save,
  Square,
  TreePine,
  Trees,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from "lucide-react";
import { mixer } from "./mixer";
import { soundCatalog } from "./synthesis";
import { type Preferences, type SoundId } from "../preferences";
import { Select } from "../components/Select";
import { Section, Slider } from "../components/Controls";
import { mixerPresets } from "./presets";
const icons = {
  fireplace: Flame,
  nature: Trees,
  ocean: Waves,
  rain: CloudRain,
  cafe: Coffee,
  forest: TreePine,
  brown: AudioLines,
  white: Wind,
  thunder: CloudLightning,
  keyboard: Keyboard,
  fan: Fan,
  theta: Headphones,
};
export default function MixerPanel({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  useSyncExternalStore(mixer.subscribe, mixer.getSnapshot);
  const [category, setCategory] = useState("All"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string[]>([]),
    [name, setName] = useState(""),
    [selected, setSelected] = useState("");
  const settings = prefs.mixer;
  const active = mixer.active;
  async function play(id: SoundId) {
    setBusy((ids) => [...ids, id]);
    try {
      if (active.includes(id)) mixer.stop(id);
      else {
        const volume = settings.levels[id] || 0.5;
        if (!settings.levels[id])
          update({
            mixer: {
              ...settings,
              levels: { ...settings.levels, [id]: volume },
            },
          });
        await mixer.start(id, volume);
      }
      setError("");
    } catch {
      setError("Audio could not start. Check browser audio permissions.");
    } finally {
      setBusy((ids) => ids.filter((x) => x !== id));
    }
  }
  return (
    <>
      <Section
        title="The sound of your room"
        description="Layer a few textures. Every track is generated locally, with its own character."
      >
        <div className="mixer-master">
          <Headphones size={22} />
          <Slider
            label="Master ambience volume"
            value={settings.master}
            onChange={(master) => {
              update({ mixer: { ...settings, master } });
              mixer.setMaster(master);
            }}
          />
          <button
            className={`icon-button ${mixer.muted ? "is-active" : ""}`}
            aria-label={
              mixer.muted ? "Unmute all ambience" : "Mute all ambience"
            }
            onClick={() => mixer.mute(!mixer.muted)}
          >
            {mixer.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button className="secondary-button" onClick={() => mixer.stopAll()}>
            <Square size={13} /> Stop all
          </button>
        </div>
        <div className="studio-toolbar">
          <Select
            label="Sound category"
            value={category}
            onChange={setCategory}
            options={["All", "Nature", "Weather", "Cozy", "Noise", "Tones"].map(
              (v) => ({ value: v, label: v }),
            )}
          />
          <span>
            {active.length} playing · {mixer.muted ? "muted" : "local audio"}
          </span>
        </div>
        <div className="mixer-grid">
          {soundCatalog
            .filter((s) => category === "All" || s.category === category)
            .map((s) => {
              const Icon = icons[s.id],
                playing = active.includes(s.id);
              return (
                <div
                  className={`sound-track ${playing ? "playing" : ""}`}
                  key={s.id}
                >
                  <div className="sound-track-heading">
                    <Icon size={21} strokeWidth={1.5} />
                    <strong>{s.name}</strong>
                    <button
                      className="track-play"
                      aria-label={`${playing ? "Pause" : "Play"} ${s.name}`}
                      disabled={busy.includes(s.id)}
                      onClick={() => void play(s.id)}
                    >
                      {playing ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  </div>
                  <p>{s.description}</p>
                  <Slider
                    label={`${s.name} volume`}
                    value={settings.levels[s.id]}
                    onChange={(value) => {
                      update({
                        mixer: {
                          ...settings,
                          levels: { ...settings.levels, [s.id]: value },
                        },
                      });
                      mixer.setVolume(s.id, value);
                    }}
                  />
                </div>
              );
            })}
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <p className="field-hint">
          These are procedural soundscapes, not field recordings. Theta Waves
          plays separate 180 Hz and 186 Hz tones in each ear; use stereo
          headphones. No learning or health benefit is claimed.
        </p>
      </Section>
      <Section
        title="Your favorite combinations"
        description="Loading a mix restores levels and stops playback. Press Play mix when you're ready."
      >
        <Select
          label="Saved mixer preset"
          value={selected}
          onChange={(id) => {
            setSelected(id);
            const preset = [...mixerPresets, ...settings.presets].find(
              (p) => p.id === id,
            );
            if (preset) {
              mixer.stopAll();
              mixer.setMaster(preset.master);
              update({
                mixer: {
                  ...settings,
                  master: preset.master,
                  levels: { ...preset.levels },
                },
              });
            }
          }}
          options={[
            { value: "", label: "Choose a soundscape" },
            ...mixerPresets.map((p) => ({ value: p.id, label: p.name })),
            ...settings.presets.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() => {
              void Promise.all(
                Object.entries(settings.levels)
                  .filter(([, level]) => level > 0)
                  .map(([id, level]) => mixer.start(id as SoundId, level)),
              ).catch(() => setError("Audio could not start."));
            }}
          >
            <Play size={14} /> Play mix
          </button>
          {settings.presets.some((p) => p.id === selected) && (
            <button
              className="text-button"
              onClick={() => {
                update({
                  mixer: {
                    ...settings,
                    presets: settings.presets.filter((p) => p.id !== selected),
                  },
                });
                setSelected("");
              }}
            >
              Delete saved mix
            </button>
          )}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              update({
                mixer: {
                  ...settings,
                  presets: [
                    ...settings.presets,
                    {
                      id: crypto.randomUUID(),
                      name: name.trim(),
                      levels: { ...settings.levels },
                      master: settings.master,
                    },
                  ],
                },
              });
              setName("");
            }
          }}
        >
          <input
            aria-label="Mixer preset name"
            placeholder="Name this mix…"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="secondary-button"
            disabled={!name.trim() || settings.presets.length >= 30}
          >
            <Save size={14} /> Save mix
          </button>
        </form>
        <label className="field-label">When a session ends</label>
        <Select
          label="Ambience on session completion"
          value={settings.onEnd}
          onChange={(onEnd) =>
            update({
              mixer: { ...settings, onEnd: onEnd as typeof settings.onEnd },
            })
          }
          options={[
            { value: "continue", label: "Keep playing" },
            { value: "fade", label: "Fade out over 4.5 seconds" },
            { value: "pause", label: "Pause ambience" },
          ]}
        />
        <p className="field-hint">
          Mixer levels are remembered. Playback never starts automatically after
          refresh or when you apply a room preset. Alarm volume and Spotify are
          separate.
        </p>
      </Section>
    </>
  );
}
