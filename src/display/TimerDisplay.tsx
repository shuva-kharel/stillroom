import type { CSSProperties } from "react";
import type { Preferences } from "../preferences";
const glyphs: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
};
export function TimerDisplay({
  text,
  display,
  progress = 0,
  running = false,
  caption = "",
  preview = false,
}: {
  text: string;
  display: Preferences["display"];
  progress?: number;
  running?: boolean;
  caption?: string;
  preview?: boolean;
}) {
  const font =
    display.style === "serif"
      ? "var(--serif)"
      : display.font === "serif"
        ? "var(--serif)"
        : display.font === "mono"
          ? "'IBM Plex Mono',monospace"
          : "'DM Sans',sans-serif";
  return (
    <div
      className={`display-stage display-${display.style} ${running ? "display-running" : ""} ${preview ? "display-preview" : ""}`}
      style={
        {
          "--timer-scale": display.size / 100,
          "--digit-color": display.digitColor || "var(--text)",
          "--timer-font": font,
          "--timer-weight": display.weight,
        } as CSSProperties
      }
    >
      {display.style === "ring" && display.progress && (
        <svg
          className="display-ring-svg"
          viewBox="0 0 400 400"
          aria-hidden="true"
        >
          <circle cx="200" cy="200" r="183" className="display-ring-track" />
          <circle cx="200" cy="200" r="193" className="display-ring-ticks" />
          <circle
            cx="200"
            cy="200"
            r="183"
            className="display-ring-progress"
            strokeDasharray={`${Math.max(3, progress * 1149.82)} 1149.82`}
            transform="rotate(-90 200 200)"
          />
        </svg>
      )}
      <div className="display-inner">
        {preview && <span className="display-eyebrow">Timer preview</span>}
        <div
          className={`display-digits ${text.length > 6 ? "many-digits" : ""}`}
          role={preview ? "img" : "timer"}
          aria-label={text}
          aria-live="off"
        >
          {display.style === "flip" ? (
            <span className="flip-digits" aria-hidden="true">
              {[...text].map((digit, i) =>
                digit === ":" ? (
                  <span className="flip-colon" key={i}>
                    :
                  </span>
                ) : (
                  <span className="flip-tile" key={i}>
                    <span key={`${i}-${digit}`} className="flip-digit">
                      {digit}
                    </span>
                  </span>
                ),
              )}
            </span>
          ) : display.style === "matrix" ? (
            <span className="matrix-digits" aria-hidden="true">
              {[...text].map((digit, i) =>
                glyphs[digit] ? (
                  <span
                    className={`matrix-digit ${digit === ":" ? "matrix-colon" : ""}`}
                    key={i}
                  >
                    {glyphs[digit]
                      .join("")
                      .split("")
                      .map((dot, n) => (
                        <i className={dot === "1" ? "lit" : ""} key={n} />
                      ))}
                  </span>
                ) : (
                  <span key={i}>{digit}</span>
                ),
              )}
            </span>
          ) : (
            text
          )}
        </div>
        {caption && <p className="display-caption">{caption}</p>}
      </div>
      {display.style !== "ring" && display.progress && (
        <div className="display-progress" aria-hidden="true">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}
export function wallClock(now: number, clock: Preferences["clock"]) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    ...(clock.seconds ? { second: "2-digit" } : {}),
    hour12: clock.hour12,
    timeZone: clock.timezone || undefined,
  }).format(now);
}
