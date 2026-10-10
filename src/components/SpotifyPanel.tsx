import { useEffect, useState } from "react";
import { ExternalLink, Music2, RefreshCw, Trash2 } from "lucide-react";
import { parseSpotify, spotifyItem } from "../spotify";
import type { Preferences } from "../preferences";
import { Select } from "./Select";
import { Section, Toggle } from "./Controls";
import { IconButton } from "./UI";
export function SpotifySettings({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}) {
  const [url, setUrl] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  const spotify = prefs.spotify;
  return (
    <Section
      title="A soundtrack of your own"
      description="Optional Spotify embeds. Enabling loads content from Spotify, which requires internet access and controls playback availability. No developer account is needed."
    >
      <Toggle
        label="Enable Spotify"
        checked={spotify.enabled}
        onChange={(enabled) =>
          update({
            spotify: { ...spotify, enabled },
            layout: { ...prefs.layout, music: enabled },
          })
        }
      />
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const item = parseSpotify(url);
            const favorite = {
              id: item.id,
              name:
                name.trim() ||
                `${item.id.split(":")[0]} · ${item.id.slice(-6)}`,
            };
            update({
              spotify: {
                ...spotify,
                selected: item.id,
                favorites: [
                  ...spotify.favorites.filter((x) => x.id !== item.id),
                  favorite,
                ],
              },
            });
            setUrl("");
            setName("");
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Spotify link
          <input
            aria-label="Spotify link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/…"
            maxLength={1000}
          />
        </label>
        <label>
          Favorite name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My reading soundtrack"
            maxLength={100}
          />
        </label>
        <button
          className="secondary-button fit"
          disabled={!url.trim() || spotify.favorites.length >= 50}
        >
          <Music2 size={15} /> Add Spotify link
        </button>
      </form>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {spotify.favorites.length > 0 && (
        <>
          <Select
            label="Saved Spotify links"
            value={spotify.selected}
            onChange={(selected) =>
              update({ spotify: { ...spotify, selected } })
            }
            options={spotify.favorites.map((x) => ({
              value: x.id,
              label: x.name,
            }))}
          />
          <div className="favorite-music-list">
            {spotify.favorites.map((x) => (
              <div key={x.id}>
                <span>{x.name}</span>
                <a
                  className="icon-button"
                  aria-label={`Open ${x.name} in Spotify`}
                  href={spotifyItem(x.id).url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />
                </a>
                <IconButton
                  label={`Remove Spotify ${x.name}`}
                  onClick={() =>
                    update({
                      spotify: {
                        ...spotify,
                        selected:
                          spotify.selected === x.id ? "" : spotify.selected,
                        favorites: spotify.favorites.filter(
                          (f) => f.id !== x.id,
                        ),
                      },
                    })
                  }
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        </>
      )}
      <Toggle
        label="Show music panel"
        checked={prefs.layout.music}
        onChange={(music) => update({ layout: { ...prefs.layout, music } })}
      />
      <Toggle
        label="Expanded Spotify player"
        checked={spotify.expanded}
        onChange={(expanded) => update({ spotify: { ...spotify, expanded } })}
      />
      <p className="field-hint">
        Spotify's official player controls playback. Ambience volume, timer
        alarms, and session-end audio actions do not control Spotify.
      </p>
    </Section>
  );
}
export default function SpotifyPanel({
  prefs,
  update,
  onAdd,
}: {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
  onAdd: () => void;
}) {
  const [status, setStatus] = useState("loading"),
    [retry, setRetry] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const s = prefs.spotify;
  const item = s.favorites.find((x) => x.id === s.selected);
  useEffect(() => {
    setStatus("loading");
    const timer = setTimeout(
      () =>
        setStatus((current) =>
          current === "loading" ? "unavailable" : current,
        ),
      12000,
    );
    return () => clearTimeout(timer);
  }, [s.selected, s.enabled, retry]);
  return (
    <section className="spotify-panel" aria-label="Spotify music">
      <div className="section-heading">
        <h3>
          <Music2 size={16} /> Your soundtrack
        </h3>
        <button
          className="text-button"
          onClick={() => update({ layout: { ...prefs.layout, music: false } })}
        >
          Hide player
        </button>
      </div>
      {!online ? (
        <p role="status">
          Spotify is unavailable offline. Your local room and ambience still
          work.
        </p>
      ) : !s.enabled ? (
        <>
          <p>Spotify is off. Enable it to load an official player.</p>
          <button className="secondary-button" onClick={onAdd}>
            Add Spotify link
          </button>
        </>
      ) : !item ? (
        <button className="secondary-button" onClick={onAdd}>
          Add Spotify link
        </button>
      ) : (
        <>
          <Select
            label="Music selection"
            value={s.selected}
            onChange={(selected) => update({ spotify: { ...s, selected } })}
            options={s.favorites.map((x) => ({ value: x.id, label: x.name }))}
          />
          {status === "loading" && <p role="status">Loading Spotify…</p>}
          {status === "unavailable" && (
            <p role="status">
              Spotify couldn't be reached. Check your connection or open it
              directly.
            </p>
          )}
          <iframe
            key={`${s.selected}-${retry}`}
            title={`Spotify: ${item.name}`}
            src={spotifyItem(item.id).embed}
            width="100%"
            height={s.expanded ? 352 : 152}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("unavailable")}
          />
          <div className="button-row">
            <a
              className="text-button"
              href={spotifyItem(item.id).url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} /> Open in Spotify
            </a>
            <button
              className="text-button"
              onClick={() => setRetry((x) => x + 1)}
            >
              <RefreshCw size={13} /> Reload
            </button>
            <button
              className="text-button"
              onClick={() =>
                update({ spotify: { ...s, expanded: !s.expanded } })
              }
            >
              {s.expanded ? "Compact" : "Expand"}
            </button>
          </div>
          <p className="field-hint">
            Player unavailable or playback limited? Availability is controlled
            by Spotify. Use the link above.
          </p>
        </>
      )}
    </section>
  );
}
