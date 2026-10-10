import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Store } from "../types";
import { elapsed, formatClock, remaining, type TimerAction } from "../timer";
type PiP = Window & {
  documentPictureInPicture?: {
    requestWindow: (options: {
      width: number;
      height: number;
    }) => Promise<Window>;
  };
};
export function MiniTimer({
  store,
  now,
  act,
  hideTrigger = false,
  owner = true,
}: {
  store: Store;
  now: number;
  act: (a: TimerAction) => void;
  hideTrigger?: boolean;
  owner?: boolean;
}) {
  const [mini, setMini] = useState<Window | null>(null),
    [fallback, setFallback] = useState(false);
  const current = useRef<Window | null>(null);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      current.current?.close();
      current.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!mini) return;
    const close = () => {
      current.current = null;
      setMini(null);
    };
    mini.addEventListener("pagehide", close);
    return () => mini.removeEventListener("pagehide", close);
  }, [mini]);
  useEffect(() => {
    if (!mini) return;
    mini.document.documentElement.dataset.theme = store.settings.theme;
    mini.document.documentElement.style.cssText =
      document.documentElement.style.cssText;
  }, [mini, store.settings.theme, store.preferences.display.accent]);
  async function open() {
    if (current.current) {
      current.current.focus();
      return;
    }
    const api = (window as PiP).documentPictureInPicture;
    if (!api) {
      setFallback(true);
      return;
    }
    try {
      const w = await api.requestWindow({ width: 350, height: 240 });
      current.current = w;
      w.document.title = "Stillroom mini timer";
      for (const element of document.querySelectorAll(
        'link[rel="stylesheet"],style',
      )) {
        const copy = element.cloneNode(true);
        if (element instanceof HTMLLinkElement && copy instanceof HTMLLinkElement)
          copy.href = element.href;
        w.document.head.append(copy);
      }
      w.document.body.style.margin = "0";
      setMini(w);
    } catch {
      setError(
        "A floating window is unavailable. The compact timer is open here.",
      );
      setFallback(true);
    }
  }
  useEffect(() => {
    const launch = () => void open();
    window.addEventListener("stillroom:mini", launch);
    return () => window.removeEventListener("stillroom:mini", launch);
  });
  useEffect(() => {
    if (!owner) {
      current.current?.close();
      setFallback(false);
    }
  }, [owner]);
  const content = (
    <div className="mini-timer">
      <div className="section-heading">
        <span className="eyebrow">STILLROOM</span>
        <button
          className="text-button"
          aria-label="Close mini timer"
          onClick={() => {
            mini?.close();
            setFallback(false);
          }}
        >
          Close
        </button>
      </div>
      <p>
        {store.subjects.find((s) => s.id === store.timer.subjectId)?.name ??
          "Independent study"}
      </p>
      <strong className="mini-digits">
        {formatClock(
          remaining(store.timer, now),
          store.timer.mode === "stopwatch",
        )}
      </strong>
      <progress
        aria-label="Mini timer progress"
        max={1}
        value={
          store.timer.mode === "stopwatch"
            ? (elapsed(store.timer, now) % 3600000) / 3600000
            : elapsed(store.timer, now) / store.timer.duration
        }
      />
      <p className="mini-intention">
        {store.timer.intention || "No session intention"}
      </p>
      <button
        className="primary-button"
        onClick={() => act({ type: "toggle" })}
      >
        {store.timer.runningSince === null ? "Start / resume" : "Pause"}
      </button>
    </div>
  );
  return (
    <>
      {!hideTrigger && (
        <button className="text-button" onClick={() => void open()}>
          Mini timer
        </button>
      )}
      {error && (
        <span className="sr-only" role="status">
          {error}
        </span>
      )}
      {mini && createPortal(content, mini.document.body)}
      {fallback &&
        createPortal(
          <aside className="mini-fallback" aria-label="Compact in-page timer">
            {content}
            <small>In-page view · always-on-top is unavailable here.</small>
          </aside>,
          document.body,
        )}
    </>
  );
}
