import { useEffect, useState } from "react";
import { Modal } from "./UI";
export interface Command {
  id: string;
  label: string;
  keywords?: string;
  run: () => void;
}
export function matchCommands(commands: Command[], query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return commands.filter((c) =>
    words.every((w) =>
      (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(w),
    ),
  );
}
export default function CommandPalette({
  commands,
  onClose,
  duration,
}: {
  commands: Command[];
  onClose: () => void;
  duration: (seconds: number) => void;
}) {
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const match = query
    .trim()
    .match(
      /^(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h|seconds?|secs?|s)$/i,
    );
  const seconds = match
    ? Number(match[1]) *
      (match[2].toLowerCase().startsWith("h")
        ? 3600
        : match[2].toLowerCase().startsWith("m")
          ? 60
          : 1)
    : 0;
  const items =
    seconds >= 1 && seconds <= 86400
      ? [
          {
            id: "duration",
            label: `Prepare a ${query.trim()} countdown`,
            run: () => duration(Math.round(seconds)),
          },
        ]
      : matchCommands(commands, query).slice(0, 40);
  const execute = (i: number) => {
    const c = items[i];
    if (c) {
      onClose();
      c.run();
    }
  };
  useEffect(() => {
    document
      .getElementById(`command-${index}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <Modal
      title="Find your next action"
      subtitle="Alt + K · use arrow keys and Enter"
      onClose={onClose}
    >
      <div className="form-stack">
        <input
          autoFocus
          aria-label="Search commands"
          placeholder="Try rain, maths, 25 minutes, notes…"
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={items[index] ? `command-${index}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, items.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              execute(index);
            }
          }}
        />
        <div
          id="command-results"
          role="listbox"
          className="command-results"
          aria-label="Commands"
        >
          {items.map((c, i) => (
            <button
              id={`command-${i}`}
              key={c.id}
              role="option"
              aria-selected={index === i}
              tabIndex={-1}
              onMouseMove={() => setIndex(i)}
              onClick={() => execute(i)}
            >
              {c.label}
            </button>
          ))}
          {!items.length && (
            <p>No matching actions. Try a subject name or “25 minutes”.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
