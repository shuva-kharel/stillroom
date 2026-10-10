import { useEffect, useState } from "react";
import { getMedia } from "../media";
export function useMedia(id: string, staticOnly = false) {
  const [value, setValue] = useState<{
    url: string;
    type: string;
    missing: boolean;
  }>({ url: "", type: "", missing: false });
  useEffect(() => {
    let cancelled = false;
    let url = "";
    setValue({ url: "", type: "", missing: false });
    if (id)
      void getMedia(id)
        .then((asset) => {
          if (cancelled) return;
          if (!asset) {
            setValue({ url: "", type: "", missing: true });
            return;
          }
          url = URL.createObjectURL(
            staticOnly && asset.poster ? asset.poster : asset.blob,
          );
          setValue({
            url,
            type: staticOnly && asset.poster ? "image/webp" : asset.type,
            missing: false,
          });
        })
        .catch(() => {
          if (!cancelled) setValue({ url: "", type: "", missing: true });
        });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, staticOnly]);
  return value;
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, []);
  return reduced;
}
