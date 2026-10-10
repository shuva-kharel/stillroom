import { useEffect, useState } from "react";
import {
  Check,
  Heart,
  ImagePlus,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import type { Preferences, BackgroundConfig } from "../preferences";
import { backgrounds, categories, backgroundCSS } from "./catalog";
import { listMedia, removeMedia, saveMedia, type MediaAsset } from "../media";
import { useMedia } from "../hooks/useMedia";
import { Select } from "../components/Select";
import { ColorField, Section, Slider, Toggle } from "../components/Controls";
import { IconButton } from "../components/UI";
export default function BackgroundStudio({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const [category, setCategory] = useState("All"),
    [target, setTarget] = useState<"background" | "breakBackground">(
      "background",
    ),
    [assets, setAssets] = useState<MediaAsset[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = prefs[target];
  const change = (patch: Partial<BackgroundConfig>) =>
    update({ [target]: { ...current, ...patch } });
  const refresh = () =>
    void listMedia()
      .then((a) => setAssets(a.filter((x) => !x.type.startsWith("audio/"))))
      .catch((e) => setError(e.message));
  useEffect(refresh, []);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const asset = await saveMedia(file, "background");
      refresh();
      change({ type: "upload", preset: "custom", mediaId: asset.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section
        title="Somewhere you'd like to be."
        description="Original illustrated scenes, quiet colors, and gently moving worlds."
      >
        <div className="background-target">
          <Toggle
            label="Use one background everywhere"
            checked={prefs.sameBackground}
            onChange={(sameBackground) => {
              update({ sameBackground });
              if (sameBackground) setTarget("background");
            }}
          />
          {!prefs.sameBackground && (
            <div className="segmented">
              <button
                aria-pressed={target === "background"}
                onClick={() => setTarget("background")}
              >
                Focus background
              </button>
              <button
                aria-pressed={target === "breakBackground"}
                onClick={() => setTarget("breakBackground")}
              >
                Break background
              </button>
            </div>
          )}
        </div>
        <div className="studio-toolbar">
          <Select
            label="Background category"
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
          <span>{backgrounds.length} original backgrounds</span>
        </div>
        <div className="background-grid">
          {backgrounds
            .filter(
              (p) =>
                category === "All" ||
                (category === "Favorites" && prefs.favorites.includes(p.id)) ||
                p.category === category,
            )
            .map((p) => (
              <div
                className={`background-card ${current.preset === p.id ? "selected" : ""}`}
                key={p.id}
              >
                <button
                  className="background-pick"
                  aria-label={`Use ${p.name} background`}
                  aria-pressed={current.preset === p.id}
                  onClick={() => update({ [target]: { ...p.config } })}
                >
                  <span
                    className={`background-thumbnail thumb-${p.animation || p.config.type}`}
                    style={{
                      background: backgroundCSS(p.config),
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {p.animation && (
                      <span className="thumbnail-motion">
                        <Play size={11} /> Live
                      </span>
                    )}
                    {current.preset === p.id && (
                      <span className="thumbnail-check">
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </button>
                <button
                  className={`favorite-background ${prefs.favorites.includes(p.id) ? "favorited" : ""}`}
                  aria-label={`${prefs.favorites.includes(p.id) ? "Unfavorite" : "Favorite"} ${p.name}`}
                  onClick={() =>
                    update({
                      favorites: prefs.favorites.includes(p.id)
                        ? prefs.favorites.filter((id) => id !== p.id)
                        : [...prefs.favorites, p.id],
                    })
                  }
                >
                  <Heart
                    size={13}
                    fill={
                      prefs.favorites.includes(p.id) ? "currentColor" : "none"
                    }
                  />
                </button>
              </div>
            ))}
        </div>
        {category === "Favorites" && !prefs.favorites.length && (
          <p className="field-hint">
            Tap a heart on any background to keep it close.
          </p>
        )}
      </Section>
      <Section
        title="Make it yours"
        description="Your changes are previewed in the room immediately. Study time is never affected."
      >
        <Select
          label="Background type"
          value={current.type}
          onChange={(v) => {
            const type = v as BackgroundConfig["type"];
            if (type === "animation")
              update({
                [target]: {
                  ...backgrounds.find((p) => p.id === "aurora")!.config,
                },
              });
            else if (type === "image")
              update({
                [target]: {
                  ...backgrounds.find((p) => p.id === "forest-mist")!.config,
                },
              });
            else change({ type, preset: "custom" });
          }}
          options={[
            { value: "solid", label: "Solid color" },
            { value: "gradient", label: "Gradient" },
            { value: "image", label: "Illustrated image" },
            { value: "animation", label: "Procedural animation" },
            { value: "upload", label: "Uploaded media" },
          ]}
        />
        {current.type === "solid" && (
          <ColorField
            label="Background color"
            value={current.color}
            onChange={(color) => change({ color, preset: "custom" })}
          />
        )}
        {current.type === "gradient" && (
          <>
            <div className="form-grid">
              {current.stops.map((color, i) => (
                <ColorField
                  key={i}
                  label={`Gradient stop ${i + 1}`}
                  value={color}
                  onChange={(v) =>
                    change({
                      stops: current.stops.map((c, n) => (n === i ? v : c)),
                      preset: "custom",
                    })
                  }
                />
              ))}
            </div>
            <div className="button-row">
              <button
                className="text-button"
                disabled={current.stops.length >= 4}
                onClick={() => change({ stops: [...current.stops, "#c7aa76"] })}
              >
                Add color stop
              </button>
              <button
                className="text-button"
                disabled={current.stops.length <= 2}
                onClick={() => change({ stops: current.stops.slice(0, -1) })}
              >
                Remove last stop
              </button>
            </div>
            <Slider
              label="Gradient angle"
              value={current.angle}
              min={0}
              max={360}
              step={1}
              unit="°"
              onChange={(angle) => change({ angle })}
            />
          </>
        )}
        {["image", "upload"].includes(current.type) && (
          <>
            <Select
              label="Image fit"
              value={current.fit}
              onChange={(v) => change({ fit: v as "cover" | "contain" })}
              options={[
                { value: "cover", label: "Fill the room" },
                { value: "contain", label: "Show whole image" },
              ]}
            />
            <div className="form-grid">
              <Slider
                label="Horizontal focal position"
                value={current.x}
                min={0}
                max={100}
                step={1}
                onChange={(x) => change({ x })}
              />
              <Slider
                label="Vertical focal position"
                value={current.y}
                min={0}
                max={100}
                step={1}
                onChange={(y) => change({ y })}
              />
            </div>
          </>
        )}
        <div className="form-grid">
          <Slider
            label="Background brightness"
            value={current.brightness}
            min={0.15}
            max={1.6}
            unit="×"
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(brightness) => change({ brightness })}
          />
          <Slider
            label="Background blur"
            value={current.blur}
            min={0}
            max={20}
            step={1}
            unit="px"
            onChange={(blur) => change({ blur })}
          />
        </div>
        <div className="form-grid">
          <ColorField
            label="Overlay color"
            value={current.overlay}
            onChange={(overlay) => change({ overlay })}
          />
          <Slider
            label="Overlay opacity"
            value={current.opacity}
            onChange={(opacity) => change({ opacity })}
          />
        </div>
        {current.type === "upload" &&
          assets
            .find((a) => a.id === current.mediaId)
            ?.type.startsWith("video/") && (
            <Slider
              label="Video playback speed"
              value={current.speed}
              min={0.2}
              max={3}
              step={0.1}
              unit="×"
              onChange={(speed) => change({ speed })}
            />
          )}
        {(current.type === "animation" ||
          (current.type === "upload" &&
            assets.find((a) => a.id === current.mediaId)?.poster)) && (
          <>
            {current.type === "animation" && (
              <div className="form-grid">
                <Slider
                  label="Animation speed"
                  value={current.speed}
                  min={0.2}
                  max={3}
                  step={0.1}
                  unit="×"
                  format={(v) => `${v.toFixed(1)}×`}
                  onChange={(speed) => change({ speed })}
                />
                <Slider
                  label="Animation intensity"
                  value={current.intensity}
                  onChange={(intensity) => change({ intensity })}
                />
              </div>
            )}
            <button
              className="secondary-button"
              aria-pressed={current.paused}
              onClick={() => change({ paused: !current.paused })}
            >
              {current.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
              {current.paused ? "Resume animation" : "Pause animation"}
            </button>
          </>
        )}
        <Toggle
          label="Soft grain"
          checked={current.grain}
          onChange={(grain) => change({ grain })}
        />
        <Toggle
          label="Edge vignette"
          checked={current.vignette}
          onChange={(vignette) => change({ vignette })}
        />
      </Section>
      <Section
        title="Your own window"
        description="JPG, PNG, WebP, GIF, WebM or MP4 · up to 30 MB. Images are optimized to 1920 px. Videos stay muted. Uploads remain on this device."
      >
        <label className={`upload-zone ${busy ? "busy" : ""}`}>
          <ImagePlus size={24} />
          <strong>
            {busy
              ? "Preparing your background…"
              : "Bring a little of your world in."}
          </strong>
          <span>
            <Upload size={14} /> Choose local media
          </span>
          <input
            disabled={busy}
            type="file"
            aria-label="Upload background"
            accept="image/jpeg,image/png,image/webp,image/gif,video/webm,video/mp4"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="uploaded-grid">
          {assets.map((asset) => (
            <UploadedTile
              key={asset.id}
              asset={asset}
              selected={
                current.mediaId === asset.id && current.type === "upload"
              }
              onSelect={() =>
                change({ type: "upload", preset: "custom", mediaId: asset.id })
              }
              onRemove={() => {
                if (
                  confirm(
                    `Remove ${asset.name} from this device? Rooms using it will show a solid fallback.`,
                  )
                )
                  void removeMedia(asset.id)
                    .then(() => {
                      refresh();
                      if (current.mediaId === asset.id)
                        change({ mediaId: "", type: "solid" });
                    })
                    .catch((e) => setError(e.message));
              }}
            />
          ))}
        </div>
        <p className="field-hint">
          Reduced motion uses a still frame. JSON backups omit local media.
          Re-upload a missing asset to replace it; existing study data is never
          changed.
        </p>
      </Section>
    </>
  );
}
function UploadedTile({
  asset,
  selected,
  onSelect,
  onRemove,
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { url } = useMedia(asset.id, true);
  return (
    <div className="uploaded-tile">
      <button
        onClick={onSelect}
        aria-label={`Use uploaded ${asset.name}`}
        aria-pressed={selected}
      >
        <img src={url || undefined} alt="" />
        <span>{asset.name}</span>
        {selected && <Check size={14} />}
      </button>
      <IconButton label={`Remove upload ${asset.name}`} onClick={onRemove}>
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}
