import { defaultBackground, type BackgroundConfig } from "../preferences";
export interface BackgroundPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  config: BackgroundConfig;
  scene?: string;
  animation?: string;
}
const make = (
  id: string,
  name: string,
  category: string,
  type: BackgroundConfig["type"],
  color: string,
  extra: Partial<BackgroundConfig> = {},
  scene?: string,
  animation?: string,
): BackgroundPreset => ({
  id,
  name,
  category,
  description:
    type === "image"
      ? "Original illustrated scene"
      : type === "animation"
        ? "Living procedural scene"
        : type === "solid"
          ? "A quiet solid color"
          : "A considered color blend",
  config: {
    ...defaultBackground,
    preset: id,
    type,
    color,
    opacity: type === "solid" ? 0 : 0.3,
    ...extra,
  },
  scene,
  animation,
});
export const backgrounds: BackgroundPreset[] = [
  make("midnight-library", "Midnight Library", "Minimal", "solid", "#1c1d19"),
  make("paper-desk", "Paper Desk", "Minimal", "solid", "#f3f0e7"),
  make("rain-window", "Rain Window", "Night", "image", "#293947", {}, "window"),
  make(
    "forest-mist",
    "Forest Mist",
    "Nature",
    "image",
    "#354e46",
    {},
    "forest",
  ),
  make("ocean-dusk", "Ocean Dusk", "Nature", "image", "#314857", {}, "ocean"),
  make(
    "cozy-fireplace",
    "Cozy Fireplace",
    "Cozy",
    "image",
    "#3e2d25",
    {},
    "fireplace",
  ),
  make(
    "mountain-dawn",
    "Mountain Dawn",
    "Nature",
    "image",
    "#9b887f",
    { opacity: 0.2 },
    "mountain",
  ),
  make(
    "sakura-evening",
    "Sakura Evening",
    "Nature",
    "image",
    "#785769",
    {},
    "sakura",
  ),
  make("coffeehouse", "Coffeehouse", "Cozy", "image", "#554536", {}, "coffee"),
  make("ink-black", "Ink Black", "Minimal", "solid", "#101113"),
  make("warm-sand", "Warm Sand", "Minimal", "solid", "#d9c8ad"),
  make(
    "aurora",
    "Aurora",
    "Animated",
    "animation",
    "#132b32",
    { stops: ["#234e4b", "#78538b"] },
    undefined,
    "aurora",
  ),
  make("lavender-fog", "Lavender Fog", "Gradients", "gradient", "#777086", {
    stops: ["#b0a2ba", "#575674"],
    angle: 130,
  }),
  make("sunset-wash", "Sunset Wash", "Gradients", "gradient", "#815965", {
    stops: ["#d0a184", "#926473", "#343b5e"],
    angle: 160,
  }),
  make(
    "slow-clouds",
    "Slow Clouds",
    "Animated",
    "animation",
    "#738b99",
    {},
    undefined,
    "clouds",
  ),
  make(
    "gentle-rain",
    "Gentle Rain",
    "Animated",
    "animation",
    "#253846",
    {},
    "window",
    "rain",
  ),
  make(
    "floating-dust",
    "Floating Dust",
    "Animated",
    "animation",
    "#332e24",
    {},
    "library",
    "dust",
  ),
  make(
    "starfield",
    "Starfield",
    "Animated",
    "animation",
    "#101724",
    {},
    undefined,
    "stars",
  ),
  make(
    "soft-waves",
    "Soft Waves",
    "Animated",
    "animation",
    "#24414d",
    {},
    "ocean",
    "waves",
  ),
  make(
    "ember-glow",
    "Ember Glow",
    "Animated",
    "animation",
    "#34251f",
    {},
    "fireplace",
    "embers",
  ),
  make(
    "reading-room",
    "Illustrated Bookshelves",
    "Academia",
    "image",
    "#554435",
    {},
    "library",
  ),
  make(
    "ivy-courtyard",
    "Ivy Courtyard",
    "Academia",
    "image",
    "#465748",
    {},
    "courtyard",
  ),
  make("blue-hour", "Blue Hour", "Night", "gradient", "#273148", {
    stops: ["#172533", "#4a5270"],
    angle: 175,
  }),
  make("moss-and-stone", "Moss & Stone", "Gradients", "gradient", "#525c43", {
    stops: ["#364e41", "#aaa589"],
    angle: 35,
  }),
];
export const categories = [
  "All",
  "Favorites",
  "Minimal",
  "Gradients",
  "Academia",
  "Nature",
  "Cozy",
  "Night",
  "Animated",
];
export function sceneSVG(kind: string): string {
  const sky =
    '<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#293e4c"/><stop offset="1" stop-color="#b2a18e"/></linearGradient><radialGradient id="fire"><stop stop-color="#ffc67b"/><stop offset="1" stop-color="#8d482c"/></radialGradient></defs>';
  let art = "";
  if (["forest", "mountain", "ocean", "sakura"].includes(kind)) {
    art +=
      '<rect width="1600" height="1000" fill="url(#sky)"/><circle cx="1140" cy="245" r="89" fill="#e6c9a0" opacity=".5"/>';
    if (kind === "mountain")
      art +=
        '<path d="M0 710 300 235 550 575 790 120 1300 725 1600 370V1000H0Z" fill="#707c80"/><path d="m690 300 100-180 180 240-165-78-40 80Z" fill="#cec5b7"/><path d="M0 875 340 585 640 900 1120 420 1600 820V1000H0Z" fill="#43565d"/>';
    if (kind === "ocean")
      art +=
        '<path d="M0 510Q800 490 1600 520V1000H0Z" fill="#334e5b"/>' +
        Array.from(
          { length: 20 },
          (_, i) =>
            `<path d="M${((i * 119) % 250) - 100} ${550 + i * 24}q300 -18 550 0t650 0t650 0" stroke="#8a9fa4" stroke-width="${1 + i * 0.13}" opacity=".3" fill="none"/>`,
        ).join("");
    if (kind === "forest")
      art +=
        '<path d="M0 610Q400 390 800 540T1600 440V1000H0Z" fill="#4c6865"/>' +
        Array.from({ length: 29 }, (_, i) => {
          const x = i * 65 - 80,
            y = 400 + ((i * 47) % 170),
            h = 260 + ((i * 31) % 150);
          return `<path d="M${x} ${y}l-90 ${h}h180Z" fill="${i % 2 ? "#344e4b" : "#294341"}"/><path d="M${x} ${y + 60}v650" stroke="#263d39" stroke-width="14"/>`;
        }).join("") +
        '<path d="M0 740Q650 570 1600 720v180Q900 690 0 890Z" fill="#bac4b8" opacity=".15"/>';
    if (kind === "sakura")
      art +=
        '<path d="M1400 1000Q1300 500 960 250M1310 650Q860 380 420 280M1260 570Q1520 270 1570 70" stroke="#453f46" stroke-width="36" fill="none"/>' +
        Array.from(
          { length: 110 },
          (_, i) =>
            `<circle cx="${420 + ((i * 151) % 1160)}" cy="${80 + ((i * 79) % 530)}" r="${12 + (i % 22)}" fill="${i % 2 ? "#cca4b2" : "#a57f92"}" opacity=".7"/>`,
        ).join("");
  } else {
    art +=
      '<rect width="1600" height="1000" fill="#433b32"/><rect x="60" y="60" width="1480" height="830" fill="#52483c" stroke="#76664f" stroke-width="9"/>';
    if (kind === "library")
      art += Array.from(
        { length: 3 },
        (_, row) =>
          `<rect x="110" y="${100 + row * 240}" width="1380" height="170" fill="#292a23"/>` +
          Array.from(
            { length: 24 },
            (_, col) =>
              `<rect x="${120 + col * 56}" y="${110 + row * 240 + ((col * 7) % 35)}" width="${24 + (col % 9)}" height="${140 - ((col * 7) % 35)}" rx="2" fill="${["#4c493c", "#4f4238", "#3c443c", "#565044", "#3c4245"][col % 5]}"/><path d="M${125 + col * 56} ${135 + row * 240}v90" stroke="#b2a18c" opacity=".25"/>`,
          ).join(""),
      ).join("");
    if (kind === "fireplace")
      art +=
        '<rect x="490" y="270" width="620" height="490" fill="#7a6651"/><rect x="455" y="245" width="690" height="45" fill="#a28a6c"/><path d="M570 760V490a230 180 0 0 1 460 0v270Z" fill="#221f1c"/><ellipse cx="800" cy="675" rx="200" ry="105" fill="url(#fire)" opacity=".5"/><path d="M690 715q-40-100 20-170 12 95 75 38-40-100 20-180 20 130 75 173 0-90 50-115 70 177-45 254Z" fill="#c37840"/><path d="M770 715q-20-80 45-140 0 70 35 80l-20 60Z" fill="#efbb72"/><path d="m650 740 280-15m-220-10 200 33" stroke="#574438" stroke-width="30"/><path d="M120 800V560q0-100 130-100t130 100v240M1220 800V560q0-100 130-100t130 100v240" fill="#6a5849" stroke="#352e27" stroke-width="16"/>';
    if (kind === "coffee")
      art +=
        '<rect x="155" y="130" width="630" height="490" fill="url(#sky)" stroke="#b4a087" stroke-width="18"/><path d="M470 130v490M155 390h630" stroke="#796953" stroke-width="12"/><path d="M1040 200h380m-380 155h380m-380 155h380" stroke="#b4a087" stroke-width="14"/>' +
        Array.from(
          { length: 9 },
          (_, i) =>
            `<rect x="${1070 + (i % 3) * 100}" y="${115 + Math.floor(i / 3) * 155}" width="55" height="75" rx="7" fill="#8e8067"/>`,
        ).join("") +
        '<path d="M0 800h1600v200H0Z" fill="#41362c"/><ellipse cx="730" cy="840" rx="310" ry="80" fill="#968267"/><path d="M650 705h160l-10 130H665Z" fill="#d8c8aa"/><path d="M810 727q100-10 65 58l-65 15" fill="none" stroke="#d8c8aa" stroke-width="16"/><path d="M705 670q-40-40 0-80t0-80" stroke="#d8c8aa" opacity=".2" fill="none" stroke-width="12"/>';
    if (kind === "window")
      art +=
        '<rect width="1600" height="1000" fill="#202f3b"/><rect x="130" y="65" width="1340" height="800" fill="url(#sky)"/><path d="M130 600Q500 480 800 620t670-40v280H130Z" fill="#33454b"/><path d="M790 65v800M130 465h1340" stroke="#283137" stroke-width="30"/>' +
        Array.from(
          { length: 95 },
          (_, i) =>
            `<path d="M${150 + ((i * 117) % 1300)} ${80 + ((i * 83) % 760)}l-5 28" stroke="#bdc9c6" opacity=".25" stroke-width="2"/>`,
        ).join("") +
        '<path d="M80 870h1440v70H80Z" fill="#70604e"/>';
    if (kind === "courtyard")
      art +=
        '<path d="M0 0h1600v1000H0Z" fill="#526450"/><path d="M120 100h1360v900H120Z" fill="#9b967b"/><path d="M560 1000V460a240 300 0 0 1 480 0v540Z" fill="#314a42"/><path d="M530 1000V450a270 335 0 0 1 540 0v550" stroke="#b7ad8e" stroke-width="35" fill="none"/>' +
        Array.from(
          { length: 60 },
          (_, i) =>
            `<ellipse cx="${120 + ((i * 89) % 1360)}" cy="${(i * 71) % 630}" rx="34" ry="20" fill="#3e5a43" opacity=".7"/>`,
        ).join("");
    art += '<path d="M0 930h1600v70H0Z" fill="#24231f" opacity=".45"/>';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">${sky}${art}</svg>`;
}
const sceneCache = new Map<string, string>();
export function sceneURL(kind: string) {
  if (!sceneCache.has(kind))
    sceneCache.set(
      kind,
      `data:image/svg+xml,${encodeURIComponent(sceneSVG(kind))}`,
    );
  return sceneCache.get(kind)!;
}
export function backgroundCSS(c: BackgroundConfig) {
  const preset = backgrounds.find((p) => p.id === c.preset);
  if (c.type === "gradient")
    return `linear-gradient(${c.angle}deg,${c.stops.join(",")})`;
  if ((c.type === "image" || c.type === "animation") && preset?.scene)
    return `url("${sceneURL(preset.scene)}")`;
  return c.color;
}
