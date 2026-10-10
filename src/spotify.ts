export function parseSpotify(input: string): {
  id: string;
  url: string;
  embed: string;
} {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Paste a Spotify playlist, album, or track URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "open.spotify.com" ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error("Use an https://open.spotify.com link.");
  const match = url.pathname.match(
    /^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album|track)\/([A-Za-z0-9]{22})\/?$/,
  );
  if (!match)
    throw new Error(
      "This link must identify a playlist, album, or track with a valid Spotify ID.",
    );
  return spotifyItem(`${match[1]}:${match[2]}`);
}
export function spotifyItem(id: string) {
  const match = id.match(/^(playlist|album|track):([A-Za-z0-9]{22})$/);
  if (!match) throw new Error("Invalid Spotify item.");
  return {
    id,
    url: `https://open.spotify.com/${match[1]}/${match[2]}`,
    embed: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`,
  };
}
