import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import type { BackgroundConfig } from "../preferences";
import { useMedia, useReducedMotion } from "../hooks/useMedia";
import { backgroundCSS, backgrounds } from "./catalog";
export const Background = memo(function Background({
  config,
  lowPower,
}: {
  config: BackgroundConfig;
  lowPower: boolean;
}) {
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(document.hidden);
  const paused = reduced || lowPower || config.paused || hidden;
  const media = useMedia(
    config.type === "upload" ? config.mediaId : "",
    paused,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [media.url]);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (video.current) {
      video.current.playbackRate = config.speed;
      if (paused) video.current.pause();
      else void video.current.play().catch(() => {});
    }
  }, [paused, media.url, config.speed]);
  const animation = backgrounds.find((p) => p.id === config.preset)?.animation;
  const style = {
    "--scene-speed": `${20 / config.speed}s`,
    "--scene-intensity": config.intensity,
    background: backgroundCSS(config),
    backgroundSize: config.fit,
    backgroundPosition: `${config.x}% ${config.y}%`,
    filter: `brightness(${config.brightness}) blur(${config.blur}px)`,
  } as CSSProperties;
  return (
    <div
      className={`room-backdrop ${paused ? "animation-paused" : ""}`}
      aria-hidden="true"
    >
      <div className="background-scene" style={style}>
        {config.type === "upload" &&
          media.url &&
          !failed &&
          (media.type.startsWith("video/") ? (
            <video
              ref={video}
              src={media.url}
              onError={() => setFailed(true)}
              muted
              loop
              playsInline
              autoPlay={!paused}
              style={{
                objectFit: config.fit,
                objectPosition: `${config.x}% ${config.y}%`,
              }}
            />
          ) : (
            <img
              src={media.url}
              onError={() => setFailed(true)}
              alt=""
              style={{
                objectFit: config.fit,
                objectPosition: `${config.x}% ${config.y}%`,
              }}
            />
          ))}
        {config.type === "animation" && animation && (
          <div className={`scene-motion motion-${animation}`}>
            {Array.from(
              {
                length:
                  animation === "clouds" ||
                  animation === "aurora" ||
                  animation === "waves"
                    ? 5
                    : 45,
              },
              (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--i": i,
                      left: `${(i * 37) % 100}%`,
                      top: `${(i * 19) % 100}%`,
                      animationDelay: `-${i * 0.7}s`,
                    } as CSSProperties
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
      <div
        className="background-overlay"
        style={{ background: config.overlay, opacity: config.opacity }}
      />
      {config.grain && <div className="background-grain" />}
      {config.vignette && <div className="background-vignette" />}
      {(media.missing || failed) && (
        <span className="media-fallback-note">
          Local background unavailable · using a solid fallback
        </span>
      )}
    </div>
  );
});
